"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { Trash2, Plus, Star, Pencil, Check, X } from "lucide-react";
import { ContextBlockCategory } from "@/lib/types/database";

interface PriorityBlock {
  id: string;
  title: string | null;
  content: string;
  category: ContextBlockCategory | null;
  always_include: boolean;
}

const CATEGORY_OPTIONS: { value: ContextBlockCategory; label: string }[] = [
  { value: "work_preferences", label: "Work Preferences" },
  { value: "personal_background", label: "Personal Background" },
  { value: "communication_style", label: "Communication Style" },
  { value: "technical_preferences", label: "Technical Preferences" },
  { value: "general", label: "General" },
];

export function PriorityPreferences({ agentId }: { agentId: string }) {
  const [blocks, setBlocks] = useState<PriorityBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<ContextBlockCategory>("general");
  
  const supabase = createClient();

  const fetchBlocks = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("context_blocks")
      .select("id, title, content, category, always_include")
      .eq("agent_id", agentId)
      .eq("always_include", true)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setBlocks(data as PriorityBlock[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBlocks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormCategory("general");
    setEditingId(null);
    setIsAdding(false);
  };

  const handleAdd = async () => {
    if (!formContent.trim()) return;
    
    setIsSaving(true);
    const { error } = await supabase
      .from("context_blocks")
      .insert({
        agent_id: agentId,
        type: "user_profile",
        title: formTitle.trim() || null,
        content: formContent.trim(),
        category: formCategory,
        always_include: true,
      });

    if (!error) {
      await fetchBlocks();
      resetForm();
    }
    setIsSaving(false);
  };

  const handleUpdate = async (id: string) => {
    if (!formContent.trim()) return;
    
    setIsSaving(true);
    const { error } = await supabase
      .from("context_blocks")
      .update({
        title: formTitle.trim() || null,
        content: formContent.trim(),
        category: formCategory,
      })
      .eq("id", id);

    if (!error) {
      await fetchBlocks();
      resetForm();
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("context_blocks")
      .delete()
      .eq("id", id);

    if (!error) {
      setBlocks(blocks.filter(b => b.id !== id));
    }
  };

  const startEditing = (block: PriorityBlock) => {
    setFormTitle(block.title || "");
    setFormContent(block.content);
    setFormCategory(block.category || "general");
    setEditingId(block.id);
    setIsAdding(false);
  };

  const startAdding = () => {
    resetForm();
    setIsAdding(true);
  };

  // Group blocks by category
  const blocksByCategory = blocks.reduce((acc, block) => {
    const cat = block.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(block);
    return acc;
  }, {} as Record<string, PriorityBlock[]>);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading preferences...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Priority Preferences</CardTitle>
          </div>
          {!isAdding && !editingId && (
            <Button size="sm" onClick={startAdding}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
        <CardDescription>
          Structured preferences that are always included in every conversation.
          Use this for specific facts about you that MAIA should always know.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add/Edit Form */}
        {(isAdding || editingId) && (
          <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
            <div className="grid gap-2">
              <Label htmlFor="blockTitle">Title (optional)</Label>
              <Input
                id="blockTitle"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Tech Stack, Location, Dietary Preferences"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="blockContent">Content</Label>
              <Textarea
                id="blockContent"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="What should MAIA always know about this?"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="blockCategory">Category</Label>
              <select
                id="blockCategory"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ContextBlockCategory)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetForm} disabled={isSaving}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={() => editingId ? handleUpdate(editingId) : handleAdd()}
                disabled={isSaving || !formContent.trim()}
              >
                <Check className="h-4 w-4 mr-1" />
                {isSaving ? "Saving..." : (editingId ? "Update" : "Add")}
              </Button>
            </div>
          </div>
        )}

        {/* Existing blocks grouped by category */}
        {blocks.length === 0 && !isAdding ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No priority preferences yet.</p>
            <p className="text-sm mt-1">Add preferences that MAIA should always remember.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(blocksByCategory).map(([category, categoryBlocks]) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {CATEGORY_OPTIONS.find(c => c.value === category)?.label || category}
                </h4>
                <div className="space-y-2">
                  {categoryBlocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-background/50 group"
                    >
                      <Star className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {block.title && (
                          <p className="font-medium text-sm">{block.title}</p>
                        )}
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {block.content}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEditing(block)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(block.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
