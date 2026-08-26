import type { ReactElement } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Loader2, LogOut, Plus, School, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { cn } from "@/lib/utils";
import { type AppProfile, type ProfileType } from "@/lib/creatorAuth";
import { toast } from "sonner";

export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "D";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

export function profileRoleLabel(
  profile: AppProfile,
  t: (key: string) => string,
) {
  if (profile.type === "buyer") return t("profileBuyer");
  if (profile.type === "school") return t("profileSchool");
  return t("profileCreator");
}

export function profileDisplayLabel(profile: AppProfile) {
  return profile.displayName?.trim() || "—";
}

export function profilesInCreationOrder(profiles: AppProfile[]) {
  return [...profiles].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });
}

type ProfileAccountRowsProps = {
  expanded: boolean;
  activeProfileId: string;
  profiles: AppProfile[];
  busyProfileId: string | null;
  creatingType: ProfileType | null;
  onSwitch: (profile: AppProfile) => void;
  onCreateSeller: (type: "creator" | "school") => void;
  onSignOut?: () => void;
  showSignOut?: boolean;
  accountHref?: string | null;
  onToggleExpanded?: () => void;
};

function CollapsedTip({
  expanded,
  label,
  children,
}: {
  expanded: boolean;
  label: string;
  children: ReactElement;
}) {
  if (expanded) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ProfileAccountRows({
  expanded,
  activeProfileId,
  profiles,
  busyProfileId,
  creatingType,
  onSwitch,
  onCreateSeller,
  onSignOut,
  showSignOut = true,
  accountHref,
  onToggleExpanded,
}: ProfileAccountRowsProps) {
  const { t } = useLanguage();
  const orderedProfiles = profilesInCreationOrder(profiles);
  const showBottomGroup = Boolean(accountHref || (showSignOut && onSignOut) || onToggleExpanded);

  const newProfileButton = (
    <button
      type="button"
      title={t("addSellerProfile")}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
        !expanded && "justify-center px-0",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border/80">
        {creatingType ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Plus className="h-4 w-4" strokeWidth={1.75} />
        )}
      </span>
      {expanded && <span className="truncate text-[15px]">{t("addSellerProfile")}</span>}
    </button>
  );

  const newProfileControl = (
    <DropdownMenu>
      {expanded ? (
        <DropdownMenuTrigger asChild>{newProfileButton}</DropdownMenuTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{newProfileButton}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{t("addSellerProfile")}</TooltipContent>
        </Tooltip>
      )}
      <DropdownMenuContent side="right" align="start" className="w-56">
        <DropdownMenuItem onClick={() => onCreateSeller("creator")} disabled={!!creatingType}>
          <BookOpen className="mr-2 h-4 w-4" />
          {t("profileCreator")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCreateSeller("school")} disabled={!!creatingType}>
          <School className="mr-2 h-4 w-4" />
          {t("profileSchool")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const profileRow = (profile: AppProfile) => {
    const active = profile.id === activeProfileId;
    const busy = busyProfileId === profile.id;
    const displayName = profileDisplayLabel(profile);
    const role = profileRoleLabel(profile, t);

    const button = (
      <button
        key={profile.id}
        type="button"
        disabled={busyProfileId !== null && !busy}
        onClick={() => onSwitch(profile)}
        className={cn(
          "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
          active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          !expanded && "justify-center px-0",
        )}
      >
        {active && (
          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#FF6B00]" aria-hidden />
        )}
        <Avatar className="h-8 w-8 shrink-0">
          {profile.avatarUrl && !busy && (
            <AvatarImage src={profile.avatarUrl} alt="" />
          )}
          <AvatarFallback
            className={cn(
              "rounded-full text-xs font-medium",
              active
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground",
            )}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              initialsFrom(displayName)
            )}
          </AvatarFallback>
        </Avatar>
        {expanded && (
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[15px] font-medium leading-tight">{displayName}</p>
            <p className="truncate text-[12px] leading-tight text-[#6B7280]">{role}</p>
          </div>
        )}
        {expanded && active && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6B00]" aria-hidden />
        )}
      </button>
    );

    if (!expanded) {
      return (
        <Tooltip key={profile.id}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="text-left">
            <p className="font-medium">{displayName}</p>
            <p className="text-xs text-[#6B7280]">{role}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };

  const bottomRowClass = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
    !expanded && "justify-center px-0",
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        {newProfileControl}
        <div className="flex flex-col overflow-y-auto">
          {orderedProfiles.map((profile) => profileRow(profile))}
        </div>
      </div>

      {showBottomGroup && (
        <>
          <div className="mx-2 my-2 border-t border-border" />
          <div className="flex shrink-0 flex-col pb-2">
            {accountHref && (
              <CollapsedTip expanded={expanded} label={t("account")}>
                <Link to={accountHref} title={t("account")} className={bottomRowClass}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <UserRound className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  {expanded && <span className="text-[15px]">{t("account")}</span>}
                </Link>
              </CollapsedTip>
            )}
            {showSignOut && onSignOut && (
              <CollapsedTip expanded={expanded} label={t("signOut")}>
                <button
                  type="button"
                  onClick={onSignOut}
                  title={t("signOut")}
                  className={bottomRowClass}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <LogOut className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  {expanded && <span className="text-[15px]">{t("signOut")}</span>}
                </button>
              </CollapsedTip>
            )}
            {onToggleExpanded && (
              <CollapsedTip expanded={expanded} label={expanded ? t("collapseNav") : t("expandNav")}>
                <button
                  type="button"
                  onClick={onToggleExpanded}
                  aria-label={expanded ? t("collapseNav") : t("expandNav")}
                  className={bottomRowClass}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                    {expanded ? (
                      <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
                    ) : (
                      <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                    )}
                  </span>
                  {expanded && (
                    <span className="text-[15px]">{t("collapseNav")}</span>
                  )}
                </button>
              </CollapsedTip>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function useProfileAccountActions() {
  const { t } = useLanguage();
  const { profiles, switchProfile, logout, user } = useSimpleAuth();

  const runSwitch = async (
    profile: AppProfile,
    navigate: (path: string) => void,
    onDone?: () => void,
  ) => {
    const activeProfileId = localStorage.getItem("profile_id") || "";
    if (profile.id === activeProfileId) {
      onDone?.();
      return;
    }
    const result = await switchProfile({ profileId: profile.id });
    if ("error" in result) {
      toast.error(t("switchProfileError"));
    } else {
      navigate(result.path);
    }
    onDone?.();
  };

  const createSeller = async (
    type: "creator" | "school",
    navigate: (path: string) => void,
    onDone?: () => void,
  ) => {
    const buyerProfile = profiles.find((p) => p.type === "buyer");
    const displayName =
      user?.name ||
      localStorage.getItem("profile_display_name") ||
      buyerProfile?.displayName ||
      undefined;
    const result = await switchProfile({ createType: type, displayName });
    if ("error" in result) {
      toast.error(t("switchProfileError"));
    } else {
      navigate(result.path);
    }
    onDone?.();
  };

  return { profiles, runSwitch, createSeller, logout };
}
