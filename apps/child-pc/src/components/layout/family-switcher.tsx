'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentFamily } from '@/components/providers/current-family-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Users } from 'lucide-react';

export function FamilySwitcher() {
  const { currentFamily, families, setCurrentFamilyId } = useCurrentFamily();
  const router = useRouter();

  if (families.length === 0) {
    return (
      <Link
        href="/"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Users className="h-4 w-4" />
        未添加老人
      </Link>
    );
  }

  const elder = currentFamily?.elder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors outline-none">
        {elder ? (
          <>
            <span>{elder.name}</span>
            <Badge
              variant={currentFamily?.isOnline ? 'default' : 'secondary'}
              className="text-[10px] px-1.5 py-0 h-4"
            >
              {currentFamily?.isOnline ? '在线' : '离线'}
            </Badge>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </>
        ) : (
          <>
            <Users className="h-4 w-4" />
            <span>选择老人</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          切换当前老人
        </div>
        {families.map((family) => (
          <DropdownMenuItem
            key={family.id}
            onClick={() => setCurrentFamilyId(family.id)}
            className="flex items-center justify-between"
          >
            <span>{family.elder.name}</span>
            {currentFamily?.id === family.id && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                当前
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/')}
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          管理老人
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
