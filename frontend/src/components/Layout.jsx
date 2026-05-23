import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="shrink-0 z-20 relative">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
