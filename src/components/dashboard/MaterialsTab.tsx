import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useSimpleMaterials } from "@/hooks/useSimplePurchases";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileText, Video, Type, Download, ExternalLink, Link as LinkIcon, Loader2, Play, X, Eye, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const getIcon = (type: string) => {
  switch (type) {
    case "video":
      return <Video className="w-5 h-5" />;
    case "file":
      return <FileText className="w-5 h-5" />;
    case "text":
      return <Type className="w-5 h-5" />;
    case "link":
      return <LinkIcon className="w-5 h-5" />;
    case "folder":
      return <Folder className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
};

// Проверяем, является ли ссылка YouTube
const getYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Проверяем, является ли ссылка Vimeo
const getVimeoVideoId = (url: string): string | null => {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
};

// Проверяем, является ли файл видео
const isDirectVideoUrl = (url: string): boolean => {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
};

interface VideoPlayerProps {
  url: string;
  onClose: () => void;
}

const VideoPlayer = ({ url, onClose }: VideoPlayerProps) => {
  const youtubeId = getYouTubeVideoId(url);
  const vimeoId = getVimeoVideoId(url);
  const isDirectVideo = isDirectVideoUrl(url);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:bg-white/20"
      >
        <X className="w-6 h-6" />
      </Button>
      
      <div className="w-full max-w-4xl aspect-video">
        {youtubeId && (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
            className="w-full h-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
        {vimeoId && (
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1`}
            className="w-full h-full rounded-lg"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}
        {isDirectVideo && (
          <video
            src={url}
            controls
            autoPlay
            className="w-full h-full rounded-lg"
          />
        )}
        {!youtubeId && !vimeoId && !isDirectVideo && (
          <div className="w-full h-full flex items-center justify-center text-white">
            <p>Видео недоступно для встроенного просмотра</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface InlineVideoPlayerProps {
  url: string;
}

const InlineVideoPlayer = ({ url }: InlineVideoPlayerProps) => {
  const youtubeId = getYouTubeVideoId(url);
  const vimeoId = getVimeoVideoId(url);
  const isDirectVideo = isDirectVideoUrl(url);

  if (youtubeId) {
    return (
      <div className="mt-3 aspect-video rounded-lg overflow-hidden">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className="mt-3 aspect-video rounded-lg overflow-hidden">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}`}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (isDirectVideo) {
    return (
      <div className="mt-3 aspect-video rounded-lg overflow-hidden">
        <video
          src={url}
          controls
          className="w-full h-full bg-black"
        />
      </div>
    );
  }

  return null;
};

const MaterialsTab = () => {
  const { data: materials, isLoading } = useSimpleMaterials();
  const { t } = useLanguage();
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set());
  const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null);
  const [openingFile, setOpeningFile] = useState<{ id: string; title: string; file_url: string } | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  const toggleVideoExpand = (materialId: string) => {
    setExpandedVideos(prev => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  const handleOpenFile = useCallback(async (material: { file_url: string; title: string }, action: 'view' | 'download') => {
    if (!material.file_url) return;
    
    try {
      setIsLoadingUrl(true);
      
      // Check if it's a path (no http) or already a URL
      const isPath = !material.file_url.startsWith('http');
      
      let url = material.file_url;
      if (isPath) {
        // Generate signed URL
        const { data, error } = await supabase.storage
          .from('materials')
          .createSignedUrl(material.file_url, 3600);
        
        if (error) throw error;
        url = data.signedUrl;
      }
      
      if (action === 'download') {
        const link = document.createElement('a');
        link.href = url;
        link.download = material.title;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(url, '_blank');
      }
      
      setOpeningFile(null);
    } catch (err) {
      console.error('Error getting file URL:', err);
      toast.error('Ошибка при открытии файла');
    } finally {
      setIsLoadingUrl(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const groupedMaterials = materials?.reduce((acc, material) => {
    const productTitle = material.product?.title || "Продукт";
    if (!acc[productTitle]) {
      acc[productTitle] = [];
    }
    acc[productTitle].push(material);
    return acc;
  }, {} as Record<string, typeof materials>) || {};

  const hasNoMaterials = !materials || materials.length === 0;

  const canPlayInline = (url: string) => {
    return getYouTubeVideoId(url) || getVimeoVideoId(url) || isDirectVideoUrl(url);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t("myMaterials")}</h2>

      {hasNoMaterials ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">{t("noMaterials")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("purchaseToAccess")}
          </p>
        </div>
      ) : (
        Object.entries(groupedMaterials).map(([productTitle, productMaterials]) => (
          <div key={productTitle} className="space-y-3">
            <h3 className="font-medium text-muted-foreground">{productTitle}</h3>
            {productMaterials?.map((material, index) => {
              const isVideo = material.type === "video" && material.file_url;
              const isExpanded = expandedVideos.has(material.id);
              const canPlay = isVideo && canPlayInline(material.file_url!);

              return (
                <Card 
                  key={material.id} 
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {getIcon(material.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground">{material.title}</h3>
                        <p className="text-sm text-muted-foreground capitalize mt-0.5">
                          {material.type === "video" ? "Видео" : material.type}
                        </p>
                        
                        {material.type === "text" && material.content && (
                          <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">
                            {material.content}
                          </p>
                        )}

                        {/* Inline Video Player */}
                        {isVideo && isExpanded && canPlay && (
                          <InlineVideoPlayer url={material.file_url!} />
                        )}
                      </div>
                      
                      {material.type === "file" && material.file_url && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="flex-shrink-0"
                          onClick={() => setOpeningFile({ id: material.id, title: material.title, file_url: material.file_url! })}
                        >
                          <ExternalLink className="w-5 h-5" />
                        </Button>
                      )}
                      
                      {isVideo && canPlay && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="flex-shrink-0"
                          onClick={() => toggleVideoExpand(material.id)}
                        >
                          <Play className={`w-5 h-5 ${isExpanded ? "text-primary" : ""}`} />
                        </Button>
                      )}

                      {isVideo && !canPlay && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="flex-shrink-0"
                          onClick={() => window.open(material.file_url!, "_blank")}
                        >
                          <ExternalLink className="w-5 h-5" />
                        </Button>
                      )}
                      
                      {material.type === "link" && material.file_url && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="flex-shrink-0"
                          onClick={() => window.open(material.file_url!, "_blank")}
                        >
                          <ExternalLink className="w-5 h-5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))
      )}

      {/* Fullscreen Video Modal */}
      {fullscreenVideo && (
        <VideoPlayer url={fullscreenVideo} onClose={() => setFullscreenVideo(null)} />
      )}

      {/* File open dialog */}
      <Dialog open={!!openingFile} onOpenChange={(open) => { if (!open) setOpeningFile(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Открыть файл</DialogTitle>
            <DialogDescription>
              {openingFile?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => openingFile && handleOpenFile(openingFile, 'view')}
              disabled={isLoadingUrl}
              className="w-full"
            >
              {isLoadingUrl ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Открыть в браузере
            </Button>
            <Button
              variant="outline"
              onClick={() => openingFile && handleOpenFile(openingFile, 'download')}
              disabled={isLoadingUrl}
              className="w-full"
            >
              {isLoadingUrl ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Скачать файл
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaterialsTab;
