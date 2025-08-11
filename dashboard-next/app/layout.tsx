import './globals.css';

export const metadata = {
  title: 'TrustHive Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="sh-container">{children}</main>
      </body>
    </html>
  );
}
