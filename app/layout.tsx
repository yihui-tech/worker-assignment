import type { Metadata } from 'next';
import './globals.css';
import Nav from './components/Nav';

export const metadata: Metadata = {
  title: 'Worker Manager',
  description: 'Worker assignment and cost tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <Nav />
        {children}
      </body>
    </html>
  );
}