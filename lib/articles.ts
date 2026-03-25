export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  content: string;
  date: string;
  readTime: string;
}

// Articles will be populated when Gordy creates content
export const articles: Article[] = [];
