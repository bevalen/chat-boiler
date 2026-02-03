/**
 * Project detail description component
 */

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ProjectDetailDescriptionProps {
  description: string | null;
  isEditing: boolean;
  editedDescription: string;
  onDescriptionChange: (description: string) => void;
}

export function ProjectDetailDescription({
  description,
  isEditing,
  editedDescription,
  onDescriptionChange,
}: ProjectDetailDescriptionProps) {
  return (
    <Card className="bg-muted/30 border-none shadow-sm">
      <CardContent className="pt-6">
        <Label className="text-xs uppercase font-bold text-muted-foreground mb-2 block tracking-wider">
          Description
        </Label>
        {isEditing ? (
          <Textarea
            value={editedDescription || ""}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="min-h-[100px] bg-background"
            placeholder="Project description..."
          />
        ) : (
          <div className="text-foreground/90 leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-strong:font-semibold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {description || "No description provided."}
            </ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
