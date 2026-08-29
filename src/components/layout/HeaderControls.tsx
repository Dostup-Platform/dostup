import { useState } from "react";
import { Bell, LogOut, MessageCircle, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AccountSheet from "@/components/layout/BuyerAccountSheet";
import {
  initialsFrom,
  profileDisplayLabel,
  profilesInCreationOrder,
  useProfileAccountActions,
} from "@/components/layout/ProfileAccountRows";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const HEADER_ICON_CLASS = "h-6 w-6";

export function headerIconButtonClass(active?: boolean) {
  return cn(
    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
    active ? "bg-accent text-white" : "text-muted-foreground hover:bg-accent/50",
  );
}

type HeaderChatsButtonProps = {
  active?: boolean;
  unread?: number;
  onClick: () => void;
};

export function HeaderChatsButton({ active, unread = 0, onClick }: HeaderChatsButtonProps) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("headerChats")}
      className={headerIconButtonClass(active)}
    >
      <MessageCircle className={HEADER_ICON_CLASS} strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

type HeaderNotificationsButtonProps = {
  active?: boolean;
  count?: number;
  onClick: () => void;
};

export function HeaderNotificationsButton({ active, count = 0, onClick }: HeaderNotificationsButtonProps) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("notifications")}
      className={headerIconButtonClass(active)}
    >
      <Bell className={HEADER_ICON_CLASS} strokeWidth={1.75} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

function accountHrefForProfileType(profileType: string | null | undefined) {
  if (profileType === "creator") return "/creator?tab=account";
  if (profileType === "school") return "/school";
  if (profileType === "buyer") return "/dashboard/account";
  return null;
}

function ActiveProfileAvatar({ className }: { className?: string }) {
  const { profiles } = useSimpleAuth();
  const activeProfileId = localStorage.getItem("profile_id") || "";
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profilesInCreationOrder(profiles)[0];
  const displayName = activeProfile ? profileDisplayLabel(activeProfile) : "—";

  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      {activeProfile?.avatarUrl && <AvatarImage src={activeProfile.avatarUrl} alt="" />}
      <AvatarFallback className="rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {initialsFrom(displayName)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Header avatar — desktop menu (account + sign out), mobile sheet (profiles + account + sign out). */
export function HeaderAccountControl() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { profileType } = useSimpleAuth();
  const { logout } = useProfileAccountActions();
  const [sheetOpen, setSheetOpen] = useState(false);

  const accountHref = accountHrefForProfileType(profileType);

  const avatarTrigger = (
    <button
      type="button"
      aria-label={t("account")}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent/50"
    >
      <ActiveProfileAvatar />
    </button>
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={t("account")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent/50"
        >
          <ActiveProfileAvatar />
        </button>
        <AccountSheet open={sheetOpen} onOpenChange={setSheetOpen} />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{avatarTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {accountHref && (
          <DropdownMenuItem asChild>
            <Link to={accountHref} className="cursor-pointer">
              <UserRound className="mr-2 h-4 w-4" />
              {t("account")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            logout();
            navigate("/");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TeacherHeaderAccountProps = {
  displayName: string;
  onAccount: () => void;
  onSignOut: () => void;
};

/** Teacher sessions use a separate auth path — avatar menu without profile switching. */
export function TeacherHeaderAccount({ displayName, onAccount, onSignOut }: TeacherHeaderAccountProps) {
  const { t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("account")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent/50"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {initialsFrom(displayName)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onAccount}>
          <UserRound className="mr-2 h-4 w-4" />
          {t("account")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
