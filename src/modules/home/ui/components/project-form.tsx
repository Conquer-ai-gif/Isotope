'use client'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import { useState } from 'react';
import {z} from 'zod'
import {zodResolver} from '@hookform/resolvers/zod'
import TextareaAutosize  from 'react-textarea-autosize'
import { ArrowUpIcon,Loader2Icon } from 'lucide-react';
import {useMutation,useQueryClient,useQuery} from '@tanstack/react-query'

import {cn} from '@/lib/utils'
import { useTRPC } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import {Form,FormField} from '@/components/ui/form'
import { useRouter } from 'next/navigation';
import { PROJECT_TEMPLATES } from '../../constants';
import { useClerk } from '@clerk/nextjs';




const formSchema =z.object({
      value:z.string()
        .min(1,{message:'Value is required'})
        .max(10000,{message:'Value is too long'}),
})


export const ProjectForm=()=>{
        
         
    const trpc =useTRPC();
    const router =useRouter()
    const queryClient = useQueryClient()
    const clerk=useClerk();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver:zodResolver(formSchema),
        defaultValues:{
            value:"",
        },
    });

       const createProject=useMutation(trpc.projects.create.mutationOptions({
        onSuccess:(data)=>{
            queryClient.invalidateQueries(
                trpc.projects.getMany.queryOptions(),
            );
            router.push(`/projects/${data.id}`)
            queryClient.invalidateQueries(
                trpc.usage.status.queryOptions()
            );
            // toast.success('Message created successfully');
        },
        onError:(error)=>{
            // Check if error is due to insufficient credits
            if(error?.message?.includes('run out of credits') || error?.data?.code === 'TOO_MANY_REQUESTS'){
                router.push('/pricing');
            } else {
                toast.error(error.message);
            }
        }
    }));

    const onSubmit = async(values:z.infer<typeof formSchema>)=>{
         await createProject.mutateAsync({
            value:values.value,
        })
        
     }

     const onSelect =(value:string)=>{
        form.setValue("value",value,{
            shouldDirty:true,
            shouldValidate:true,
            shouldTouch:true,
        })
    };
        
    const [isFocused,setIsFocused] = useState(false);
    const isPending =createProject.isPending;
    const isButtonDisabled = isPending || !form.formState.isValid

    return (
        <Form {...form}>
            <section className="space-y-6">
             <form
                onSubmit={form.handleSubmit(onSubmit)}
                className={cn(   
                    "relative border p-4 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
                    isFocused && "shadow-xs",
                )}
            >
                  <FormField 
                    control={form.control}
                    name="value"
                    render={({field})=>(
                        <TextareaAutosize 
                            {...field}
                            disabled={isPending}
                            onFocus={()=> setIsFocused(true)}
                            onBlur={()=> setIsFocused(false)}
                            minRows={2}
                            maxRows={8}
                            className="pt-4 resize-none border-none w-full outline-none bg-transparent"
                            placeholder='Describe what you want to build...'
                            onKeyDown={(e)=>{
                                if(e.key ==="Enter"  && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    form.handleSubmit(onSubmit)(e);
                                }
                            }}
                        />
                    )}
                />
                 <div className="flex gap-x-2 items-end justify-between pt-2">
                    <div className="text-[10px] text-muted-foreground font-mono">
                      <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground  ">
                        <span>Enter</span>
                      </kbd>
                      &nbsp; to submit
                    </div>
                    <Button
                    disabled={isButtonDisabled}
                        className={cn(
                            "size-8 rounded-full",
                            isButtonDisabled && "bg-muted-foreground border",
                        )}
                    >
                        {!!isPending ? (<Loader2Icon className="animate-spin"/>
                         ) :(
                        <ArrowUpIcon/>
                        )}
                    </Button> 
                </div>
            </form>

            <div className="flex flex-wrap justify-center gap-2 hidden md:flex max-w-3xl">
                {PROJECT_TEMPLATES.slice(0, 6).map((template) => (
                    <Button
                        key={template.title}
                        variant="outline"
                        size="sm"
                        className="bg-white dark:bg-sidebar"
                        onClick={() => onSelect(template.prompt)}
                    >
                        {template.emoji} {template.title}
                    </Button>
                ))}
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-sidebar"
                    asChild
                >
                    <a href="/templates">Browse all templates →</a>
                </Button>
            </div>
        </section>
         </Form>
    )
}

