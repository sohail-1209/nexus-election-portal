// The admin layout has been removed to allow the dashboard to control its own full-screen layout.
// Page-specific layouts will now be handled directly within the page files.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
