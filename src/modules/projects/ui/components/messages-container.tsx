'use client'

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MessageCard } from "./message-card";
import { MessageForm } from "./message-form";
import { useEffect, useRef } from "react";
import { Fragment } from "@/generated/prisma/client";
import { GenerationProgress } from "@/components/generation-progress";

interface Props {
  projectId: string;
  activeFragment: Fragment | null;
  setActiveFragment: (fragment: Fragment | null) => void;
  elementContext?: string | null;
  onElementContextUsed?: () => void;
  onSuggestionSelect?: (prompt: string) => void;
  suggestionPrompt?: string | null;
  onSuggestionUsed?: () => void;
}

export const MessagesContainer = ({
  projectId,
  activeFragment,
  setActiveFragment,
  elementContext,
  onElementContextUsed,
  onSuggestionSelect,
  suggestionPrompt,
  onSuggestionUsed,
}: Props) => {
  const trpc = useTRPC()
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageIdRef = useRef<string | null>(null)

  const { data: messages } = useSuspenseQuery(trpc.messages.getMany.queryOptions({
    projectId: projectId,
  }, {
    refetchInterval: 2000
  }))

  useEffect(() => {
    const lastAssistantMessage = messages.findLast(
      (message) => message.role === 'ASSISTANT'
    );

    if (
      lastAssistantMessage?.fragment && lastAssistantMessage.id !== lastAssistantMessageIdRef.current
    ) {
      setActiveFragment(lastAssistantMessage.fragment);
      lastAssistantMessageIdRef.current = lastAssistantMessage.id
    }
  }, [messages, setActiveFragment])

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages.length]);

  const lastMessage = messages[messages.length - 1]
  const isLastMessageUser = lastMessage?.role === 'USER';
  const lastAssistantResultId = [...messages].reverse()
    .find((m) => m.role === 'ASSISTANT' && m.type === 'RESULT')?.id;

  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 pt-4">
      {messages.map((message) => (
        <MessageCard
          key={message.id}
          role={message.role}
          content={message.content}
          createdAt={message.createdAt}
          fragment={message.fragment}
          isActiveFragment={activeFragment?.id === message.fragment?.id}
          onFragmentClick={(f) => setActiveFragment(f)}
          type={message.type}
          projectId={projectId}
          imageUrl={message.imageUrl}
          isLatest={message.id === lastAssistantResultId}
          onSuggestionSelect={onSuggestionSelect}
          messageId={message.id}
          plan={message.plan}
          planStatus={message.planStatus}
        />
      ))}

      {/* Live progress panel — replaces the fake spinner while generation runs */}
      {isLastMessageUser && (
        <GenerationProgress messageId={lastMessage.id} />
      )}

      <div ref={bottomRef} />

      <MessageForm
        projectId={projectId}
        elementContext={elementContext}
        onElementContextUsed={onElementContextUsed}
        suggestionPrompt={suggestionPrompt}
        onSuggestionUsed={onSuggestionUsed}
        onSuggestionSelect={onSuggestionSelect}
      />
    </div>
  )
}
