import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  AVATAR_PREVIEW_SIZE,
  avatarFileError,
  cropToSquare,
  type AvatarFileError,
} from "@/lib/avatarImage";

export function useAvatarCrop() {
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoomState] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const previewStyle = useMemo(() => {
    if (!image) return undefined;
    const minSide = Math.min(image.naturalWidth, image.naturalHeight);
    const scale = (AVATAR_PREVIEW_SIZE * zoom) / minSide;
    return {
      width: `${image.naturalWidth * scale}px`,
      height: `${image.naturalHeight * scale}px`,
      transform: `translate(calc(-50% + ${-offset.x * scale}px), calc(-50% + ${-offset.y * scale}px))`,
    };
  }, [image, zoom, offset]);

  const setZoom = (newZoom: number) => {
    const clamped = Math.min(3.5, Math.max(1, newZoom));
    setZoomState(clamped);
    if (!image) return;
    const minSide = Math.min(image.naturalWidth, image.naturalHeight);
    const crop = minSide / clamped;
    const maxX = Math.max(0, (image.naturalWidth - crop) / 2);
    const maxY = Math.max(0, (image.naturalHeight - crop) / 2);
    setOffset((prev) => ({
      x: Math.min(maxX, Math.max(-maxX, prev.x)),
      y: Math.min(maxY, Math.max(-maxY, prev.y)),
    }));
  };

  const resetCrop = () => {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    setImage(null);
    setZoomState(1);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source);
    };
  }, [source]);

  const loadFile = (file: File): AvatarFileError | null => {
    const error = avatarFileError(file);
    if (error) return error;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setSource(url);
      setZoomState(1);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !image) return;
    const minSide = Math.min(image.naturalWidth, image.naturalHeight);
    const scale = (AVATAR_PREVIEW_SIZE * zoom) / minSide;
    const dx = (event.clientX - dragRef.current.x) / scale;
    const dy = (event.clientY - dragRef.current.y) / scale;
    const crop = minSide / zoom;
    const maxX = Math.max(0, (image.naturalWidth - crop) / 2);
    const maxY = Math.max(0, (image.naturalHeight - crop) / 2);
    setOffset({
      x: Math.min(maxX, Math.max(-maxX, dragRef.current.ox - dx)),
      y: Math.min(maxY, Math.max(-maxY, dragRef.current.oy - dy)),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const cropToFile = async () => {
    if (!image) throw new Error("image");
    const blob = await cropToSquare(image, zoom, offset.x, offset.y);
    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  };

  return {
    source,
    image,
    zoom,
    setZoom,
    offset,
    previewStyle,
    loadFile,
    resetCrop,
    cropToFile,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
