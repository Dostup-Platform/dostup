import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProductTeachers } from "@/hooks/useProductTeachers";
import { useLanguage } from "@/contexts/LanguageContext";
import { Copy, Loader2, Link2, User, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ShareLinkDialogProps {
  productId: string;
  productTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

type TeacherOption = "author" | "student_choice" | string;

const ShareLinkDialog = ({ productId, productTitle, isOpen, onClose }: ShareLinkDialogProps) => {
  const { language } = useLanguage();
  const { data: teachers = [], isLoading } = useProductTeachers(productId);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherOption>("author");

  const generateLink = () => {
    let link = `${window.location.origin}/product/${productId}`;
    
    if (selectedTeacher === "student_choice") {
      link += "?teacher=choice";
    } else if (selectedTeacher !== "author") {
      // Encode teacher name for URL
      link += `?teacher=${encodeURIComponent(selectedTeacher)}`;
    }
    // "author" = no param, student sees author's schedule
    
    return link;
  };

  const handleCopyLink = () => {
    const link = generateLink();
    navigator.clipboard.writeText(link);
    toast.success(language === "ru" ? "Ссылка скопирована!" : "Сілтеме көшірілді!");
    onClose();
  };

  const hasTeachers = teachers.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            {language === "ru" ? "Поделиться ссылкой" : "Сілтемемен бөлісу"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            {productTitle}
          </p>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : hasTeachers ? (
            <div className="space-y-3">
              <Label>
                {language === "ru" 
                  ? "Чьё расписание увидит ученик?" 
                  : "Студент кімнің кестесін көреді?"}
              </Label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="author">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {language === "ru" ? "Моё расписание (автор)" : "Менің кестем (автор)"}
                    </div>
                  </SelectItem>
                  <SelectItem value="student_choice">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {language === "ru" ? "Ученик выберет сам" : "Студент өзі таңдайды"}
                    </div>
                  </SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.teacher_name}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {teacher.teacher_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedTeacher === "author" && (
                  language === "ru" 
                    ? "Ученик увидит ваше расписание" 
                    : "Студент сіздің кестеңізді көреді"
                )}
                {selectedTeacher === "student_choice" && (
                  language === "ru" 
                    ? "Ученик сможет выбрать учителя в разделе расписания" 
                    : "Студент кесте бөлімінде мұғалімді таңдай алады"
                )}
                {selectedTeacher !== "author" && selectedTeacher !== "student_choice" && (
                  language === "ru" 
                    ? `Ученик увидит расписание учителя: ${selectedTeacher}` 
                    : `Студент мұғалімнің кестесін көреді: ${selectedTeacher}`
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {language === "ru" 
                ? "Учителя не добавлены. Ученик увидит ваше расписание." 
                : "Мұғалімдер қосылмаған. Студент сіздің кестеңізді көреді."}
            </p>
          )}

          <Button onClick={handleCopyLink} className="w-full" variant="default">
            <Copy className="w-4 h-4 mr-2" />
            {language === "ru" ? "Скопировать ссылку" : "Сілтемені көшіру"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareLinkDialog;
