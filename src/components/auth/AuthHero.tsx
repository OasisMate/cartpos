interface AuthHeroProps {
  title: string
  subtitle: string
  description: string
}

export function AuthHero({ title, subtitle, description }: AuthHeroProps) {
  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-blue-900 to-orange-600 flex items-center justify-center p-8 md:p-12">
      <div className="text-white max-w-lg text-center md:text-left">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-8 leading-tight">
          {title}
        </h1>
        <p className="text-lg md:text-xl text-blue-100 mb-4">{subtitle}</p>
        <p className="text-base md:text-lg text-blue-200">{description}</p>
      </div>
    </div>
  )
}

