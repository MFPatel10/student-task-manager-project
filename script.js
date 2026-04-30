document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
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

    // Initialize
    renderTasks();

    // Event Listeners
    taskForm.addEventListener('submit', addTask);
    taskList.addEventListener('click', handleTaskAction);
    clearCompletedBtn.addEventListener('click', clearCompleted);

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
            const newTask = {
                id: Date.now().toString(),
                text,
                description, // Save description with task
                deadline, // Save deadline with task
                priority,
                completed: false,
                createdAt: new Date().toISOString()
            };

            tasks.unshift(newTask); // Add to beginning
            saveTasks();
            renderTasks();

            // Reset form
            taskInput.value = '';
            descriptionInput.value = ''; // Reset description field
            deadlineInput.value = ''; // Reset deadline field
            taskInput.focus();
        }
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
                    <button class="delete-btn" aria-label="Delete task">
                        <i class="fas fa-trash-alt"></i>
                    </button>
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
