export default function AdminBackground() {
  return (
    <div className="admin-bg fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-bg-primary to-[rgba(226,184,48,0.03)]" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(226,184,48,0.04)_0%,transparent_70%)]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(226,184,48,0.03)_0%,transparent_70%)]" />
    </div>
  );
}
