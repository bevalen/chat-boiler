/**
 * Hook for creating tasks
 */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/components/shared/task-dialog";

interface NewTask {
  title: string;
  description: string;
  priority: string;
  due_date: string;
}

export function useCreateTask(
  projectId: string,
  agentId: string,
  onTaskCreated: (task: Task) => void
) {
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState<NewTask>({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;
    setIsCreatingTask(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        agent_id: agentId,
        title: newTask.title,
        description: newTask.description || null,
        priority: newTask.priority,
        project_id: projectId,
        due_date: newTask.due_date || null,
        status: "todo",
      })
      .select("*, projects(id, title)")
      .single();

    if (!error && data) {
      onTaskCreated(data as Task);
      setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
      setIsCreateTaskOpen(false);
    }
    setIsCreatingTask(false);
  };

  return {
    isCreateTaskOpen,
    setIsCreateTaskOpen,
    newTask,
    setNewTask,
    isCreatingTask,
    handleCreateTask,
  };
}
