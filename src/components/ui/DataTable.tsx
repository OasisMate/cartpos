import * as React from 'react'

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full border-collapse">{children}</table>
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-[hsl(var(--muted))]">{children}</thead>
}

export function TR({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-[hsl(var(--border))]">{children}</tr>
}

export function TH({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`p-2 text-left text-sm font-medium text-[hsl(var(--muted-foreground))] ${className}`}>{children}</th>
}

export function TD({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-2 text-sm ${className}`}>{children}</td>
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-6 text-center text-[hsl(var(--muted-foreground))]">
        {message}
      </td>
    </tr>
  )
}

export function SkeletonRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-2">
        <div className="h-5 w-full bg-[hsl(var(--muted))] animate-pulse rounded" />
      </td>
    </tr>
  )
}


