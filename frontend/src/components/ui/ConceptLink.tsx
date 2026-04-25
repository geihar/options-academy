import { Link } from 'react-router-dom'

interface ConceptLinkProps {
  href: string
  children: React.ReactNode
}

export function ConceptLink({ href, children }: ConceptLinkProps) {
  return (
    <Link
      to={href}
      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors text-sm"
    >
      {children}
    </Link>
  )
}
