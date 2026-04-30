document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const addBtn = document.getElementById('add-btn'); // Add button
    const cancelEditBtn = document.getElementById('cancel-edit-btn'); // Cancel edit button
    const descriptionInput = document.getElementById('description-input'); // Description input
    const deadlineInput = document.getElementById('deadline-input'); // New deadline input element
    const priorityInput = document.getElementById('priority-input');
    const taskList = document.getElementById('task-list');
    const taskCount = document.getElementById('task-count');
    const clearCompletedBtn = document.getElementById('clear-completed');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const emptyState = document.getElementById('empty-state');

    // State
    let tasks = JSON.parse(localStorage.getItem('studentTasks')) || [];
    let currentFilter = 'all';
    let editingTaskId = null; // Track which task is being edited

    // Initialize
    renderTasks();

    // Event Listeners
    taskForm.addEventListener('submit', addTask);
    taskList.addEventListener('click', handleTaskAction);
    clearCompletedBtn.addEventListener('click', clearCompleted);
    if(cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit); // Cancel edit listener

    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active class
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Update filter and render
            currentFilter = e.target.dataset.filter;
            renderTasks();
        });
    });

    // Functions
    function addTask(e) {
        e.preventDefault();

        const text = taskInput.value.trim();
        const description = descriptionInput.value.trim(); // Get description value
        const deadline = deadlineInput.value; // Get deadline value
        const priority = priorityInput.value;

        if (text !== '') {
            if (editingTaskId) {
                // Update existing task
                tasks = tasks.map(task => {
                    if (task.id === editingTaskId) {
                        return { ...task, text, description, deadline, priority };
                    }
                    return task;
                });
                editingTaskId = null;
                addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
                cancelEditBtn.classList.add('hidden');
            } else {
                // Add new task
                const newTask = {
                    id: Date.now().toString(),
                    text,
                    description,
                    deadline,
                    priority,
                    completed: false,
                    createdAt: new Date().toISOString()
                };
                tasks.unshift(newTask);
            }

            saveTasks();
            renderTasks();

            // Reset form
            taskInput.value = '';
            descriptionInput.value = ''; // Reset description field
            deadlineInput.value = ''; // Reset deadline field
            taskInput.focus();
        }
    }

    function cancelEdit() {
        editingTaskId = null;
        taskInput.value = '';
        descriptionInput.value = '';
        deadlineInput.value = '';
        
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
        cancelEditBtn.classList.add('hidden');
    }

    function handleTaskAction(e) {
        // Toggle completion
        if (e.target.classList.contains('task-checkbox')) {
            const taskId = e.target.closest('.task-item').dataset.id;
            toggleTaskStatus(taskId);
        }

        // Delete task
        if (e.target.closest('.delete-btn')) {
            const taskId = e.target.closest('.task-item').dataset.id;
            deleteTask(taskId);
        }

        // Edit task
        if (e.target.closest('.edit-btn')) {
            const taskId = e.target.closest('.task-item').dataset.id;
            editTask(taskId);
        }
    }

    function editTask(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        // Populate form with task data
        taskInput.value = task.text;
        descriptionInput.value = task.description || '';
        deadlineInput.value = task.deadline || '';
        priorityInput.value = task.priority || 'medium';

        // Set edit mode
        editingTaskId = id;
        addBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        cancelEditBtn.classList.remove('hidden');
        
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
        taskInput.focus();
    }

    function toggleTaskStatus(id) {
        tasks = tasks.map(task => {
            if (task.id === id) {
                return { ...task, completed: !task.completed };
            }
            return task;
        });

        saveTasks();
        renderTasks();
    }

    function deleteTask(id) {
        // Add fade out animation class before removing
        const taskElement = document.querySelector(`[data-id="${id}"]`);
        if (taskElement) {
            taskElement.style.animation = 'slideOut 0.3s ease forwards';

            setTimeout(() => {
                tasks = tasks.filter(task => task.id !== id);
                saveTasks();
                renderTasks();
            }, 300); // Wait for animation to finish
        } else {
            tasks = tasks.filter(task => task.id !== id);
            saveTasks();
            renderTasks();
        }
    }

    function clearCompleted() {
        tasks = tasks.filter(task => !task.completed);
        saveTasks();
        renderTasks();
    }

    function saveTasks() {
        localStorage.setItem('studentTasks', JSON.stringify(tasks));
    }

    function renderTasks() {
        // Filter tasks
        let filteredTasks = tasks;
        if (currentFilter === 'active') {
            filteredTasks = tasks.filter(task => !task.completed);
        } else if (currentFilter === 'completed') {
            filteredTasks = tasks.filter(task => task.completed);
        }

        // Clear list
        taskList.innerHTML = '';

        // Handle empty state
        if (tasks.length === 0) {
            taskList.classList.add('hidden');
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = "You're all caught up! Add a task to get started.";
        } else if (filteredTasks.length === 0) {
            taskList.classList.add('hidden');
            emptyState.classList.remove('hidden');
            if (currentFilter === 'active') {
                emptyState.querySelector('p').textContent = "No active tasks. Good job!";
            } else if (currentFilter === 'completed') {
                emptyState.querySelector('p').textContent = "No completed tasks yet. Get to work!";
            }
        } else {
            taskList.classList.remove('hidden');
            emptyState.classList.add('hidden');

            // Render filtered tasks
            filteredTasks.forEach(task => {
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''}`;
                li.dataset.id = task.id;

                li.innerHTML = `
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark task as completed">
                    <div class="task-content">
                        <span class="task-text">${escapeHTML(task.text)}</span>
                        <!-- Show description if it exists -->
                        ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ''}
                        <div class="task-meta">
                            <span class="priority-badge priority-${task.priority}">${task.priority} Priority</span>
                            <!-- Show deadline if it exists -->
                            ${task.deadline ? `<span class="deadline-badge" title="Deadline"><i class="far fa-calendar-alt"></i> ${new Date(task.deadline).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                    <div class="task-actions">
                        <!-- Edit button -->
                        <button class="edit-btn" aria-label="Edit task">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" aria-label="Delete task">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `;

                taskList.appendChild(li);
            });
        }

        // Update counts
        const activeTasks = tasks.filter(task => !task.completed).length;
        taskCount.textContent = `${activeTasks} task${activeTasks !== 1 ? 's' : ''} left`;

        // Manage clear completed button visibility
        const completedTasks = tasks.filter(task => task.completed).length;
        clearCompletedBtn.style.visibility = completedTasks > 0 ? 'visible' : 'hidden';
    }

    // Utility to prevent XSS
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }
});

// Add this style dynamically for the delete animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(20px);
        }
    }
`;
document.head.appendChild(style);

