'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FolderKanban, Truck } from 'lucide-react';

const projectsLinks = [
  { href: '/projects', label: 'Projects' },
  { href: '/assignments', label: 'Assignments' },
  { href: '/timesheets', label: 'Timesheets' },
  { href: '/cost', label: 'Cost Dashboard' },
];

const tripsLinks = [
  { href: '/trips', label: 'Trips' },
  { href: '/bins', label: 'Bins' },
  { href: '/customers', label: 'Customers' },
  { href: '/analytics', label: 'Analytics' },
];

export default function Nav() {
  const pathname = usePathname();

  const navLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={`text-sm font-medium px-1 py-0.5 rounded transition-colors ${
        pathname === href
          ? 'text-blue-600 border-b-2 border-blue-600 pb-0.5 rounded-none'
          : 'text-gray-500 hover:text-gray-800'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-white border-b px-8 py-3 flex items-center gap-5">
      <Link href="/" className="mr-2 flex-shrink-0">
        <Image src="/logo.jpg" alt="Yi Hui Tech" width={36} height={36} className="rounded" />
      </Link>

      <div className="flex items-center gap-1.5">
        <FolderKanban size={13} className="text-gray-400" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Projects</span>
      </div>
      {projectsLinks.map(l => navLink(l.href, l.label))}

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <div className="flex items-center gap-1.5">
        <Truck size={13} className="text-gray-400" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Trips</span>
      </div>
      {tripsLinks.map(l => navLink(l.href, l.label))}
    </nav>
  );
}
