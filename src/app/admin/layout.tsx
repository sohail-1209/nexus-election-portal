// This layout can be used for admin-specific global elements.
// It creates a full-width container for the admin section.

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-full">
      {children}
    </div>
  );
}
