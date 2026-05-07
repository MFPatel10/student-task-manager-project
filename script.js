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
    const addBtn = document.getElementById('add-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const descriptionInput = document.getElementById('description-input');
    const deadlineInput = document.getElementById('deadline-input');
    const priorityInput = document.getElementById('priority-input');
    const searchInput = document.getElementById('search-input');
    const taskList = document.getElementById('task-list');
    const taskCount = document.getElementById('task-count');
    const clearCompletedBtn = document.getElementById('clear-completed');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const emptyState = document.getElementById('empty-state');

    // Dashboard summary cards
    const totalTasksCount = document.getElementById('summary-total');
    const completedTasksCount = document.getElementById('summary-completed');
    const pendingTasksCount = document.getElementById('summary-pending');
    const overdueTasksCount = document.getElementById('summary-overdue');

    // State
    let tasks = [];
    let currentFilter = 'all';
    let currentSearchTerm = '';
    let editingTaskId = null;
    let currentUser = null;
    let unsubscribeTasksListener = null;
    let unsubscribeLegacyListener = null;

    renderTasks();

    auth.onAuthStateChanged(user => {
        if (user) {
            authSection.classList.add('hidden');
            appSection.classList.remove('hidden');
            userEmailDisplay.textContent = user.email;
            currentUser = user;
            loadTasks();
        } else {
            authSection.classList.remove('hidden');
            appSection.classList.add('hidden');
            userEmailDisplay.textContent = '';
            currentUser = null;
            tasks = [];

            // Prevent stale listeners when logging out
            if (unsubscribeTasksListener) {
                unsubscribeTasksListener();
                unsubscribeTasksListener = null;
            }
            if (unsubscribeLegacyListener) {
                unsubscribeLegacyListener();
                unsubscribeLegacyListener = null;
            }

            renderTasks();
        }
    });

    function loadTasks() {
        if (!currentUser) return;

        if (unsubscribeTasksListener) unsubscribeTasksListener();
        if (unsubscribeLegacyListener) unsubscribeLegacyListener();

        // Read all task once and filter on the client for compatibility with older schemas.
        // This avoids missing tasks that were saved with different owner keys.
        unsubscribeTasksListener = db.collection('tasks').onSnapshot(snapshot => {
            const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            tasks = allTasks.filter(task => {
                const ownerId = task.userId || task.uid || task.user_id || task.ownerId;
                return ownerId === currentUser.uid;
            });

            tasks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            renderTasks();
        }, error => {
            console.error('Error loading tasks:', error);
        });
    }

    loginBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) return showAuthError('Please enter email and password');

        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                emailInput.value = '';
                passwordInput.value = '';
                authError.classList.add('hidden');
            })
            .catch(error => showAuthError(error.message));
    });

    registerBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) return showAuthError('Please enter email and password');

        auth.createUserWithEmailAndPassword(email, password)
            .then(() => {
                emailInput.value = '';
                passwordInput.value = '';
                authError.classList.add('hidden');
            })
            .catch(error => showAuthError(error.message));
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut().catch(error => console.error('Logout error:', error));
    });

    function showAuthError(message) {
        authError.textContent = message;
        authError.classList.remove('hidden');
    }

    taskForm.addEventListener('submit', addTask);
    taskList.addEventListener('click', handleTaskAction);
    clearCompletedBtn.addEventListener('click', clearCompleted);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            currentSearchTerm = event.target.value.trim().toLowerCase();
            renderTasks();
        });
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            // Use currentTarget so nested clicks always resolve to the button.
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.dataset.filter;
            renderTasks();
        });
    });

    function addTask(e) {
        e.preventDefault();

        const text = taskInput.value.trim();
        const description = descriptionInput.value.trim();
        const deadline = deadlineInput.value;
        const priority = priorityInput.value;

        if (!text || !currentUser) return;

        const payload = { text, description, deadline, priority };

        if (editingTaskId) {
            db.collection('tasks').doc(editingTaskId).update(payload)
                .then(() => {
                    editingTaskId = null;
                    addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
                    cancelEditBtn.classList.add('hidden');
                })
                .catch(error => console.error('Error updating task:', error));
        } else {
            db.collection('tasks').add({
                userId: currentUser.uid,
                uid: currentUser.uid,
                ...payload,
                completed: false,
                createdAt: new Date().toISOString()
            }).catch(error => console.error('Error adding task:', error));
        }

        taskForm.reset();
        priorityInput.value = 'medium';
        taskInput.focus();
    }

    function cancelEdit() {
        editingTaskId = null;
        taskForm.reset();
        priorityInput.value = 'medium';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
        cancelEditBtn.classList.add('hidden');
    }

    function handleTaskAction(e) {
        const checkbox = e.target.closest('.task-checkbox');
        if (checkbox) {
            const taskId = checkbox.closest('.task-item').dataset.id;
            toggleTaskStatus(taskId);
        }

        if (e.target.closest('.delete-btn')) {
            const taskId = e.target.closest('.task-item').dataset.id;
            deleteTask(taskId);
        }

        if (e.target.closest('.edit-btn')) {
            const taskId = e.target.closest('.task-item').dataset.id;
            editTask(taskId);
        }
    }

    function editTask(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        taskInput.value = task.text;
        descriptionInput.value = task.description || '';
        deadlineInput.value = task.deadline || '';
        priorityInput.value = task.priority || 'medium';

        editingTaskId = id;
        addBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        cancelEditBtn.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        taskInput.focus();
    }

    function toggleTaskStatus(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        db.collection('tasks').doc(id).update({ completed: !task.completed })
            .catch(error => console.error('Error toggling task status:', error));
    }

    function deleteTask(id) {
        db.collection('tasks').doc(id).delete()
            .catch(error => console.error('Error deleting task:', error));
    }

    function clearCompleted() {
        const completedTasks = tasks.filter(task => task.completed);
        const batch = db.batch();

        completedTasks.forEach(task => {
            batch.delete(db.collection('tasks').doc(task.id));
        });

        batch.commit().catch(error => console.error('Error clearing completed tasks:', error));
    }

    function getDueStatus(deadline) {
        if (!deadline) return { label: 'Normal', className: 'due-normal' };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(deadline);
        dueDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((dueDate - today) / 86400000);

        if (diffDays < 0) return { label: 'Overdue', className: 'due-overdue' };
        if (diffDays <= 1) return { label: 'Urgent', className: 'due-urgent' };
        if (diffDays <= 3) return { label: 'Due Soon', className: 'due-soon' };

        return { label: 'Normal', className: 'due-normal' };
    }

    function matchesCurrentFilter(task) {
        if (currentFilter === 'active') return !task.completed;
        if (currentFilter === 'completed') return task.completed;
        if (currentFilter === 'overdue') return getDueStatus(task.deadline).label === 'Overdue' && !task.completed;
        if (currentFilter === 'high-priority') return task.priority === 'high';
        return true;
    }

    function renderTasks() {
        const filteredTasks = tasks
            .filter(task => matchesCurrentFilter(task))
            .filter(task => {
                if (!currentSearchTerm) return true;
                const haystack = `${task.text} ${task.description || ''}`.toLowerCase();
                return haystack.includes(currentSearchTerm);
            });

        taskList.innerHTML = '';

        if (tasks.length === 0) {
            taskList.classList.add('hidden');
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = "You're all caught up! Add a task to get started.";
        } else if (filteredTasks.length === 0) {
            taskList.classList.add('hidden');
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = 'No tasks match your filter/search.';
        } else {
            taskList.classList.remove('hidden');
            emptyState.classList.add('hidden');

            filteredTasks.forEach(task => {
                const dueStatus = getDueStatus(task.deadline);
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''}`;
                li.dataset.id = task.id;

                li.innerHTML = `
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark task as completed">
                    <div class="task-content">
                        <span class="task-text">${escapeHTML(task.text)}</span>
                        ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ''}
                        <div class="task-meta">
                            <span class="priority-badge priority-${task.priority}">${task.priority} Priority</span>
                            <span class="due-badge ${dueStatus.className}">${dueStatus.label}</span>
                            ${task.deadline ? `<span class="deadline-badge" title="Deadline"><i class="far fa-calendar-alt"></i> ${new Date(task.deadline).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="edit-btn" aria-label="Edit task"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" aria-label="Delete task"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;

                taskList.appendChild(li);
            });
        }

        const completedCount = tasks.filter(task => task.completed).length;
        const pendingCount = tasks.filter(task => !task.completed).length;
        const overdueCount = tasks.filter(task => !task.completed && getDueStatus(task.deadline).label === 'Overdue').length;

        taskCount.textContent = `${pendingCount} task${pendingCount !== 1 ? 's' : ''} left`;
        clearCompletedBtn.style.visibility = completedCount > 0 ? 'visible' : 'hidden';

        if (totalTasksCount) totalTasksCount.textContent = tasks.length;
        if (completedTasksCount) completedTasksCount.textContent = completedCount;
        if (pendingTasksCount) pendingTasksCount.textContent = pendingCount;
        if (overdueTasksCount) overdueTasksCount.textContent = overdueCount;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
    }
});
