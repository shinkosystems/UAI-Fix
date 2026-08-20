import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface MediaLightboxProps {
    src: string | null;
    isOpen: boolean;
    onClose: () => void;
    title?: string;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
    src,
    isOpen,
    onClose,
    title
}) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !src) return null;

    const isVideo = (url: string) => {
        const lower = url.toLowerCase();
        return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.includes('/video');
    };

    return (
        <div 
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Header com Ações e Botão Fechar */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3 z-10" onClick={e => e.stopPropagation()}>
                <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all backdrop-blur-md border border-white/10 cursor-pointer"
                    title="Abrir mídia original"
                >
                    <ExternalLink size={18} />
                </a>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-2.5 rounded-full bg-white/20 hover:bg-red-600 text-white transition-all backdrop-blur-md border border-white/20 hover:border-red-500 cursor-pointer shadow-lg active:scale-95"
                    title="Fechar (Esc)"
                >
                    <X size={20} />
                </button>
            </div>

            {title && (
                <div className="absolute top-5 left-6 text-white/80 text-xs font-bold tracking-wider uppercase z-10 pointer-events-none drop-shadow-md">
                    {title}
                </div>
            )}

            {/* Container da Mídia */}
            <div 
                className="max-w-5xl max-h-[90vh] flex items-center justify-center relative select-none animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {isVideo(src) ? (
                    <video 
                        src={src} 
                        controls 
                        autoPlay
                        className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-white/10"
                    />
                ) : (
                    <img 
                        src={src} 
                        alt={title || 'Visualização em tela cheia'} 
                        className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-white/10"
                    />
                )}
            </div>
        </div>
    );
};

export default MediaLightbox;
