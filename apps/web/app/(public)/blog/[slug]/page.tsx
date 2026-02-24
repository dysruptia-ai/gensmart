export default function BlogPostPage({ params }: { params: { slug: string } }) {
  return <div style={{ padding: '2rem' }}><h1>Blog Post: {params.slug}</h1></div>;
}
