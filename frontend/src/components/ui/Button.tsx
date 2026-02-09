import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger'
}

export default function Button({ children, tone = 'secondary', className = '', ...props }: ButtonProps) {
  return <button className={`button button-${tone} ${className}`.trim()} {...props}>{children}</button>
}
