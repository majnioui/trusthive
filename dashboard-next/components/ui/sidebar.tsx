"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Inbox, Settings } from 'lucide-react';

// --- Primitive components (shadcn-like API) ---
export function Sidebar({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col ${className}`}>{children}</div>;
}

export function SidebarContent({ children }: { children?: React.ReactNode }) {
  return <div className="p-2">{children}</div>;
}

export function SidebarGroup({ children }: { children?: React.ReactNode }) {
  return <div className="mb-4">{children}</div>;
}

export function SidebarGroupLabel({ children }: { children?: React.ReactNode }) {
  return <div className="px-3 text-xs font-semibold text-[var(--sidebar-foreground)] mb-2">{children}</div>;
}

export function SidebarGroupContent({ children }: { children?: React.ReactNode }) {
  return <div className="px-1">{children}</div>;
}

export function SidebarMenu({ children }: { children?: React.ReactNode }) {
  return <ul className="space-y-1">{children}</ul>;
}

export function SidebarMenuItem({ children }: { children?: React.ReactNode }) {
  return <li>{children}</li>;
}

export function SidebarMenuButton({ asChild, children, className = '', ...props }: { asChild?: boolean; children?: any; className?: string } & React.HTMLAttributes<HTMLButtonElement>) {
  // asChild allows passing an anchor (<a>) as the child and we simply forward props
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      className: `${className} ${children.props.className || ''}`.trim(),
      ...props,
    });
  }

  return (
    <button {...props} className={className}>
      {children}
    </button>
  );
}

// --- AppSidebar: docs-style example with collapsible behaviour ---
export function AppSidebar() {
  const pathname = usePathname() || '/dashboard';
  const [collapsed, setCollapsed] = React.useState(false);

  const items = [
    { title: 'Reviews', url: '/dashboard', icon: Home },
    { title: 'Review Requests', url: '/dashboard/requests', icon: Inbox },
    { title: 'Look & Feel', url: '/dashboard/look-and-feel', icon: Settings },
  ];

  return (
    // make aside relative so we can position the toggle outside
    <aside className={`relative transition-all duration-200 ease-in-out border-r min-h-screen ${collapsed ? 'w-20' : 'w-52'} bg-[var(--sidebar)]`}>
      <div className="flex items-center p-3">
        <div className={`flex items-center w-full ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? '' : 'pl-3'}`}>
            <div className="rounded-md bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] w-11 h-11 flex items-center justify-center">TH</div>
            {!collapsed ? (
              <div>
                <h3 className="text-sm font-semibold">TrustHive</h3>
                <p className="text-xs text-[var(--sidebar-accent-foreground)]">Dashboard</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Toggle placed absolutely so it sits outside the sidebar edge */}
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-3 right-[-18px] rounded-md p-1 bg-[var(--sidebar)] hover:bg-[var(--sidebar-border)] border"
        >
          <svg className={`w-4 h-4 transform ${!collapsed ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4l8 6-8 6V4z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className="p-2 pt-6">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map(item => {
                    const ActiveIcon = item.icon;
                    const active = pathname === item.url || (item.url === '/dashboard' && pathname === '/dashboard');
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <Link
                            href={item.url}
                            className={`group flex items-center ${collapsed ? 'justify-center px-2' : 'justify-start px-3'} w-full rounded-md py-2 text-sm transition-colors duration-150 ${
                              active
                                ? 'bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]'
                                : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                            }`}
                          >
                            {/* icon container: fixed width so icon has breathing room */}
                            <span className={`flex items-center justify-center ${collapsed ? 'mx-auto' : 'mr-2'}`}>
                              <ActiveIcon className={`${collapsed ? 'w-5 h-5' : 'w-5 h-5'}`} />
                            </span>

                            {!collapsed ? <span className="truncate">{item.title}</span> : null}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </div>
    </aside>
  );
}

export default AppSidebar;
