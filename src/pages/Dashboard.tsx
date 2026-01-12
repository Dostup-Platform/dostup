import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Calendar, User } from "lucide-react";
import MaterialsTab from "@/components/dashboard/MaterialsTab";
import ScheduleTab from "@/components/dashboard/ScheduleTab";
import AccountTab from "@/components/dashboard/AccountTab";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("materials");

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-4 safe-area-inset">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-foreground">My Dashboard</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="materials" className="mt-0 animate-fade-in">
            <MaterialsTab />
          </TabsContent>
          <TabsContent value="schedule" className="mt-0 animate-fade-in">
            <ScheduleTab />
          </TabsContent>
          <TabsContent value="account" className="mt-0 animate-fade-in">
            <AccountTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border safe-area-inset">
        <div className="max-w-2xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full h-16 bg-transparent rounded-none grid grid-cols-3 gap-1">
              <TabsTrigger 
                value="materials" 
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none"
              >
                <FileText className="w-5 h-5" />
                <span className="text-xs">Materials</span>
              </TabsTrigger>
              <TabsTrigger 
                value="schedule" 
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none"
              >
                <Calendar className="w-5 h-5" />
                <span className="text-xs">Schedule</span>
              </TabsTrigger>
              <TabsTrigger 
                value="account" 
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none"
              >
                <User className="w-5 h-5" />
                <span className="text-xs">Account</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;
