// This layout can be used for admin-specific global elements.
// It creates a full-width container for the admin section.

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The w-full class is removed from here and managed at the page level
    // to allow for full-screen layouts like the dashboard.
    <>
      {children}
    </>
  );
}
