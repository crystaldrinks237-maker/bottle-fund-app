import type { Metadata } from 'next';
import { ReviewPage } from '@/components/site/ReviewPage';

export const metadata: Metadata = { title: { absolute: 'Leave a review — Crystal Drinks' }, description: 'Tell us about your experience with Crystal Drinks.', robots: { index: false, follow: false } };
export default function Page() { return <ReviewPage />; }
