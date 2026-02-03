/**
 * Project detail tasks component
 */

import { Plus, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ItemRow } from "@/components/shared/item-row";
import type { Task, Assignee } from "@/components/shared/task-dialog";

interface ProjectDetailTasksProps {
  tasks: Task[];
  assignees: Assignee[];
  activeCount: number;
  onTaskClick: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onCreateTaskClick: () => void;
}

export function ProjectDetailTasks({
  tasks,
  assignees,
  activeCount,
  onTaskClick,
  onToggleComplete,
  onCreateTaskClick,
}: ProjectDetailTasksProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            Tasks
          </h2>
          <Badge variant="secondary" className="ml-2">
            {activeCount} active
          </Badge>
        </div>
        <Button onClick={onCreateTaskClick}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-muted/50 p-4 rounded-full mb-4">
                <ListTodo className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No tasks yet</h3>
              <p className="text-muted-foreground max-w-sm mt-2 mb-6">
                Get started by adding tasks to track progress for this project.
              </p>
              <Button onClick={onCreateTaskClick}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Task
              </Button>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {tasks.map((task) => (
                <ItemRow
                  key={task.id}
                  title={task.title}
                  status={task.status}
                  priority={task.priority}
                  dueDate={task.due_date}
                  assigneeType={task.assignee_type}
                  assigneeId={task.assignee_id}
                  assignees={assignees}
                  commentCount={(task as any).task_comments?.[0]?.count || 0}
                  isCompleted={task.status === "done"}
                  showCheckbox
                  showDescription={false}
                  onCheckboxChange={() => onToggleComplete(task)}
                  onClick={() => onTaskClick(task)}
                  variant="task"
                  className="hover:bg-muted/50 transition-colors"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
