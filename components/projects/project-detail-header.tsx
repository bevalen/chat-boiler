/**
 * Project detail header component
 * Handles project title, status, priority display and editing
 */

import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FullProject {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ProjectDetailHeaderProps {
  project: FullProject;
  isEditing: boolean;
  editedProject: {
    title: string;
    description: string;
    priority: string;
    status: string;
  };
  onEditChange: (editing: boolean) => void;
  onEditedProjectChange: (project: ProjectDetailHeaderProps["editedProject"]) => void;
  onSave: () => void;
  onDeleteClick: () => void;
  getPriorityColor: (priority: string | null) => string;
  getStatusColor: (status: string | null) => string;
}

export function ProjectDetailHeader({
  project,
  isEditing,
  editedProject,
  onEditChange,
  onEditedProjectChange,
  onSave,
  onDeleteClick,
  getPriorityColor,
  getStatusColor,
}: ProjectDetailHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="pl-0 text-muted-foreground hover:text-foreground mb-2"
          onClick={() => router.push("/projects")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Projects
        </Button>

        {isEditing ? (
          <div className="space-y-4 max-w-xl">
            <Input
              value={editedProject.title}
              onChange={(e) =>
                onEditedProjectChange({ ...editedProject, title: e.target.value })
              }
              className="text-3xl font-bold h-auto py-2"
            />
            <div className="flex gap-4">
              <Select
                value={editedProject.status || "active"}
                onValueChange={(value) =>
                  onEditedProjectChange({ ...editedProject, status: value })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={editedProject.priority || "medium"}
                onValueChange={(value) =>
                  onEditedProjectChange({ ...editedProject, priority: value })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="outline" className={getStatusColor(project.status)}>
                {project.status}
              </Badge>
              <Badge variant="outline" className={getPriorityColor(project.priority)}>
                {project.priority} priority
              </Badge>
              <span className="text-sm text-muted-foreground ml-2">
                Last updated{" "}
                {project.updated_at
                  ? new Date(project.updated_at).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {isEditing ? (
          <>
            <Button variant="outline" onClick={() => onEditChange(false)}>
              Cancel
            </Button>
            <Button onClick={onSave}>Save Changes</Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => onEditChange(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Project
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDeleteClick}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
