type PagePlaceholderProps = {
  title: string
  description: string
}

function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <main className="main-page placeholder-page">
      <p className="placeholder-label">Temporary layout</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  )
}

export default PagePlaceholder