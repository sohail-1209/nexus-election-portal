import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import ClientHeader from '@/components/app/ClientHeader';
import Footer from '@/components/app/Footer';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/app/ThemeProvider';
import { cn } from '@/lib/utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'N.E.X.U.S Election Board',
  description: 'Administer and participate in elections securely and easily.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'N.E.X.U.S Election Board',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#00796B" />
      </head>
      <body className={cn(`${inter.variable} font-body antialiased min-h-screen flex flex-col`, "debug-screens")} suppressHydrationWarning={true}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ClientHeader />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
