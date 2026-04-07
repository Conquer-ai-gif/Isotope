'use client'

import Link from 'next/link'
import Image from 'next/image'
import {SignedOut,SignInButton,SignUpButton, SignedIn} from '@clerk/nextjs'

import {Button} from '@/components/ui/button'
import { UserControl } from '@/components/user-control'
import { useScroll } from '@/hooks/use-scroll'
import {cn} from '@/lib/utils';


export const Navbar =()=>{
    const isScrolled=useScroll()
    return(
        <nav className={cn('p-4 bg-transparent fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b border-transparent',
            isScrolled && 'bg-background border-border'
        )}>
            <div className="max-w-5xl mx-auto w-full flex justify-between items-center">
                <Link href='/' className='flex items-center gap-2'>
                    <Image src='/logo.svg' alt='Luno' width={24} height={24} />
                    <span className="font-semibold text-lg">
                        Luno
                    </span>
                </Link>
                <SignedOut>
                    <div className="flex gap-2">
                        <SignUpButton>
                            <Button variant='outline' size='sm'>
                                Sign up
                            </Button>
                        </SignUpButton>
                        <SignInButton>
                            <Button size='sm'>
                                Sign in
                            </Button>
                        </SignInButton>
                    </div>
                </SignedOut>
                <SignedIn>
                    <div className="flex items-center gap-3">
                        <Link href='/docs' className='text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block'>
                            Docs
                        </Link>
                        <Link href='/marketplace' className='text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block'>
                            Marketplace
                        </Link>
                        <Link href='/workspaces' className='text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block'>
                            Workspaces
                        </Link>
                        <Link href='/templates' className='text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block'>
                            Templates
                        </Link>
                        <Link href='/usage' className='text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block'>
                            Usage
                        </Link>
                        <Link href='/feedback' className='text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block'>
                            Feedback
                        </Link>
                        <Link href='/changelog' className='text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block'>
                            Changelog
                        </Link>
                        <Link href='/settings' className='text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block'>
                            Settings
                        </Link>
                        <UserControl showName />
                    </div>
                 </SignedIn> 
            </div>
        </nav>
    )
}