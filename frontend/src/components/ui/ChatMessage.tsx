import { Swords, User } from 'lucide-react'

export type Message = {
  role: 'user' | 'metis'
  content: string
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-metis-border text-metis-text-dim'
            : 'bg-metis-accent/20 text-metis-accent'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
      </div>

      {/* Bolha */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-metis-accent text-white rounded-tr-sm'
            : 'bg-metis-surface border border-metis-border text-metis-text rounded-tl-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
