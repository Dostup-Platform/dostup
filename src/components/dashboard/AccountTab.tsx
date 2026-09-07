import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useSimplePurchases } from "@/hooks/useSimplePurchases";
import { Loader2 } from "lucide-react";
import AccountSettingsView from "@/components/account/AccountSettingsView";

const AccountTab = () => {
  const { user } = useSimpleAuth();
  const { data: purchases, isLoading: purchasesLoading } = useSimplePurchases();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AccountSettingsView
      role="buyer"
      displayName={user.name}
      createdAt={user.created_at}
      userId={user.id}
      purchases={purchases}
      purchasesLoading={purchasesLoading}
    />
  );
};

export default AccountTab;
