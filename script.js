document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userEmailDisplay = document.getElementById('user-email');
    const authError = document.getElementById('auth-error');

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
    let tasks = []; // Tasks will be loaded from Firestore
    let currentFilter = 'all';
    let editingTaskId = null; // Track which task is being edited
    let currentUser = null; // Track the logged-in user

    // Initialize UI
    renderTasks();

    // Firebase Auth State Listener
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is logged in
            authSection.classList.add('hidden');
            appSection.classList.remove('hidden');
            userEmailDisplay.textContent = user.email;
            currentUser = user;
            loadTasks(); // Load tasks from Firestore
        } else {
            // User is logged out
            authSection.classList.remove('hidden');
            appSection.classList.add('hidden');
            userEmailDisplay.textContent = '';
            currentUser = null;
            tasks = [];
            renderTasks();
        }
    });

    // Load user tasks from Firestore
    function loadTasks() {
        if (!currentUser) return;
        
        db.collection('tasks')
            .where('userId', '==', currentUser.uid)
            .onSnapshot(snapshot => {
                tasks = snapshot.docs.map(doc => {
                    return { id: doc.id, ...doc.data() };
                });
                
                // Sort locally by createdAt (newest first) to avoid needing a Firestore composite index
                tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                renderTasks(); // Re-render the UI when data changes
            }, error => {
                console.error("Error loading tasks:", error);
            });
    }

    // Auth Event Listeners
    loginBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) {
            showAuthError('Please enter email and password');
            return;
        }
        
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                emailInput.value = '';
                passwordInput.value = '';
                authError.classList.add('hidden');
                alert('Login successful!');
            })
            .catch(error => {
                showAuthError(error.message);
                alert('Login failed: ' + error.message);
            });
    });

    registerBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) {
            showAuthError('Please enter email and password');
            return;
        }

        auth.createUserWithEmailAndPassword(email, password)
            .then(() => {
                emailInput.value = '';
                passwordInput.value = '';
                authError.classList.add('hidden');
                alert('Registration successful!');
            })
            .catch(error => {
                showAuthError(error.message);
                alert('Registration failed: ' + error.message);
            });
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut()
            .then(() => alert('Logout successful!'))
            .catch(error => {
                console.error('Logout error:', error);
                alert('Logout failed: ' + error.message);
            });
    });

    function showAuthError(message) {
        authError.textContent = message;
        authError.classList.remove('hidden');
    }

    // Task Event Listeners
    taskForm.addEventListener('submit', addTask);
    taskList.addEventListener('click', handleTaskAction);
    clearCompletedBtn.addEventListener('click', clearCompleted);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit); // Cancel edit listener

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

        if (text !== '' && currentUser) {
            if (editingTaskId) {
                // Update existing task in Firestore
                db.collection('tasks').doc(editingTaskId).update({
                    text,
                    description,
                    deadline,
                    priority
                }).then(() => {
                    editingTaskId = null;
                    addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
                    cancelEditBtn.classList.add('hidden');
                }).catch(error => console.error("Error updating task:", error));
            } else {
                // Add new task to Firestore
                const newTask = {
                    userId: currentUser.uid,
                    text,
                    description,
                    deadline,
                    priority,
                    completed: false,
                    createdAt: new Date().toISOString()
                };
                
                db.collection('tasks').add(newTask)
                    .catch(error => console.error("Error adding task:", error));
            }

            // Notice we do NOT need to manually modify the tasks array or call renderTasks() here,
            // because our onSnapshot listener will automatically detect the change and update the UI!

            // Reset form
            taskInput.value = '';
            descriptionInput.value = ''; // Reset description field
            deadlineInput.value = ''; // Reset deadline field
            priorityInput.value = 'medium'; // Reset priority
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
        const task = tasks.find(t => t.id === id);
        if (task) {
            db.collection('tasks').doc(id).update({
                completed: !task.completed
            }).catch(error => console.error("Error toggling task status:", error));
        }
    }

    function deleteTask(id) {
        // Add fade out animation class before removing
        const taskElement = document.querySelector(`[data-id="${id}"]`);
        if (taskElement) {
            taskElement.style.animation = 'slideOut 0.3s ease forwards';

            setTimeout(() => {
                db.collection('tasks').doc(id).delete()
                    .catch(error => console.error("Error deleting task:", error));
            }, 300); // Wait for animation to finish
        } else {
            db.collection('tasks').doc(id).delete()
                .catch(error => console.error("Error deleting task:", error));
        }
    }

    function clearCompleted() {
        const completedTasks = tasks.filter(task => task.completed);
        
        // Use a Firestore batch to delete multiple tasks efficiently
        const batch = db.batch();
        completedTasks.forEach(task => {
            const taskRef = db.collection('tasks').doc(task.id);
            batch.delete(taskRef);
        });
        
        batch.commit().catch(error => console.error("Error clearing completed tasks:", error));
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
