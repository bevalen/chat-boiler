import React from "react";
import { ExternalLink } from "lucide-react";

// Custom markdown components for better link rendering
export const markdownComponents = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (!href) return <span>{children}</span>;
    
    // Handle mailto and tel links differently (no external icon, no target blank)
    const isMailto = href.startsWith('mailto:');
    const isTel = href.startsWith('tel:');
    const isAnchor = href.startsWith('#');
    const isInternal = href.startsWith('/');
    
    // Internal links and special links (mailto, tel, anchor) open in same window
    if (isMailto || isTel || isAnchor || isInternal) {
      return (
        <a
          href={href}
          className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/40 hover:decoration-primary/60 transition-all font-medium"
          {...props}
        >
          {children}
        </a>
      );
    }
    
    // External links: Extract domain for display if link text is a URL
    const childText = typeof children === 'string' ? children : '';
    const isUrlText = childText.startsWith('http://') || childText.startsWith('https://');
    let displayText: React.ReactNode = children;
    
    if (isUrlText) {
      try {
        const url = new URL(href);
        // Show clean domain instead of full URL
        displayText = url.hostname.replace('www.', '');
      } catch {
        // Keep original if URL parsing fails
        displayText = children;
      }
    }
    
    // External links open in new tab with icon
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-baseline gap-1 text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/40 hover:decoration-primary/60 transition-all font-medium"
        {...props}
      >
        <span>{displayText}</span>
        <ExternalLink className="w-3 h-3 inline-block opacity-50 flex-shrink-0" />
      </a>
    );
  },
  // Enhanced blockquote styling for citations and important notes
  blockquote: ({ children, ...props }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => {
    return (
      <blockquote
        className="border-l-2 border-primary/50 bg-primary/5 py-2 px-4 my-3 rounded-r-md italic"
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  // Enhanced code block styling
  code: ({ inline, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
    if (inline) {
      return (
        <code
          className="bg-black/30 px-1.5 py-0.5 rounded text-primary/90 font-mono text-xs"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  // Style headers appropriately
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-xl font-semibold mt-4 mb-2" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-lg font-semibold mt-3 mb-2" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-base font-semibold mt-2 mb-1" {...props}>{children}</h3>
  ),
  // Add horizontal scroll for wide tables
  table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-3">
      <table className="border-collapse" {...props}>{children}</table>
    </div>
  ),
};
