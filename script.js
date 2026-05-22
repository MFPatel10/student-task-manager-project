document.addEventListener('DOMContentLoaded', () => {
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const authForm = document.getElementById('auth-form');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const refreshTasksBtn = document.getElementById('refresh-tasks');
    const userEmailDisplay = document.getElementById('user-email');
    const syncStatus = document.getElementById('sync-status');
    const authError = document.getElementById('auth-error');
    const toast = document.getElementById('toast');

    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const addBtn = document.getElementById('add-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const descriptionInput = document.getElementById('description-input');
    const deadlineInput = document.getElementById('deadline-input');
    const priorityInput = document.getElementById('priority-input');
    const estimateInput = document.getElementById('estimate-input');
    const categoryInput = document.getElementById('category-input');
    const searchInput = document.getElementById('search-input');
    const sortInput = document.getElementById('sort-input');
    const categoryFilter = document.getElementById('category-filter');
    const taskList = document.getElementById('task-list');
    const taskCount = document.getElementById('task-count');
    const clearCompletedBtn = document.getElementById('clear-completed');
    const exportTasksBtn = document.getElementById('export-tasks');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const emptyState = document.getElementById('empty-state');
    const upcomingList = document.getElementById('upcoming-list');
    const priorityBreakdown = document.getElementById('priority-breakdown');
    const plannerCount = document.getElementById('planner-count');
    const plannerList = document.getElementById('planner-list');
    const workloadTotal = document.getElementById('workload-total');
    const workloadGrid = document.getElementById('workload-grid');
    const riskLevel = document.getElementById('risk-level');
    const averageStudyTime = document.getElementById('average-study-time');
    const topCategory = document.getElementById('top-category');
    const onTimeCount = document.getElementById('on-time-count');
    const priorityChart = document.getElementById('priority-chart');
    const categoryChart = document.getElementById('category-chart');

    const summaryTotal = document.getElementById('summary-total');
    const summaryCompleted = document.getElementById('summary-completed');
    const summaryPending = document.getElementById('summary-pending');
    const summaryOverdue = document.getElementById('summary-overdue');
    const summaryHighPriority = document.getElementById('summary-high-priority');
    const completionPercent = document.getElementById('completion-percent');
    const completionBar = document.getElementById('completion-bar');

    let tasks = [];
    let currentFilter = 'all';
    let currentSearchTerm = '';
    let currentSort = 'newest';
    let currentCategoryFilter = 'all';
    let editingTaskId = null;
    let currentUser = null;
    let taskRefreshTimer = null;
    let isLoadingTasks = false;
    let isSavingTask = false;

    auth.onAuthStateChanged((user) => {
        resetListeners();
        if (user) {
            currentUser = user;
            authSection.classList.add('hidden');
            appSection.classList.remove('hidden');
            userEmailDisplay.textContent = user.email || 'Logged in';
            loadTasks();
        } else {
            currentUser = null;
            tasks = [];
            authSection.classList.remove('hidden');
            appSection.classList.add('hidden');
            renderTasks();
        }
    });

    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAuth('login');
    });
    loginBtn.addEventListener('click', () => handleAuth('login'));
    registerBtn.addEventListener('click', () => handleAuth('register'));
    logoutBtn.addEventListener('click', () => auth.signOut());
    refreshTasksBtn.addEventListener('click', () => refreshTasksFromFirestore(true));

    taskForm.addEventListener('submit', addTask);
    cancelEditBtn.addEventListener('click', cancelEdit);
    taskList.addEventListener('click', handleTaskAction);
    clearCompletedBtn.addEventListener('click', clearCompleted);
    exportTasksBtn.addEventListener('click', exportTasks);
    searchInput.addEventListener('input', (e) => { currentSearchTerm = e.target.value.trim().toLowerCase(); renderTasks(); });
    sortInput.addEventListener('change', (e) => { currentSort = e.target.value; renderTasks(); });
    categoryFilter.addEventListener('change', (e) => { currentCategoryFilter = e.target.value; renderTasks(); });

    filterBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach((b) => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.dataset.filter;
            renderTasks();
        });
    });

    function handleAuth(mode) {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) return showAuthError('Please enter email and password.');

        const authAction = mode === 'login'
            ? auth.signInWithEmailAndPassword(email, password)
            : auth.createUserWithEmailAndPassword(email, password);

        authAction.then(() => {
            authError.classList.add('hidden');
            emailInput.value = '';
            passwordInput.value = '';
            showToast(mode === 'login' ? 'Logged in successfully.' : 'Registered successfully.');
        }).catch((error) => showAuthError(error.message));
    }

    function showAuthError(message) {
        authError.textContent = message;
        authError.classList.remove('hidden');
    }

    function resetListeners() {
        if (taskRefreshTimer) {
            clearInterval(taskRefreshTimer);
            taskRefreshTimer = null;
        }
    }

    function loadTasks() {
        if (!currentUser) return;

        isLoadingTasks = true;
        renderTasks();

        refreshTasksFromFirestore(true);
        taskRefreshTimer = setInterval(refreshTasksFromFirestore, 10000);
    }

    function saveTask(payload) {
        setSavingState(true);

        if (editingTaskId) {
            return saveTaskCopies(editingTaskId, {
                ...payload,
                uid: currentUser.uid,
                userId: currentUser.uid
            }, true).then(() => {
                showToast('Task updated.');
                cancelEdit();
                return refreshTasksFromFirestore();
            }).finally(() => setSavingState(false));
        }

        const taskId = createTaskId();
        return saveTaskCopies(taskId, {
            ...payload,
            uid: currentUser.uid,
            userId: currentUser.uid,
            completed: false,
            createdAt: new Date().toISOString()
        }, false).then(() => {
            showToast('Task saved to Firestore.');
            taskForm.reset();
            priorityInput.value = 'medium';
            return refreshTasksFromFirestore();
        }).finally(() => setSavingState(false));
    }

    function saveTaskCopies(id, data, merge) {
        const writes = [
            writeFirestoreDocument(`users/${currentUser.uid}/tasks/${id}`, data),
            writeFirestoreDocument(`tasks/${id}`, data)
        ];

        return Promise.allSettled(writes).then((results) => {
            if (results.every((result) => result.status === 'rejected')) {
                throw results[0].reason;
            }
        });
    }

    function addTask(e) {
        e.preventDefault();
        if (!currentUser) return;

        const text = taskInput.value.trim();
        if (!text) {
            showError('Please enter a task title.');
            return;
        }

        const payload = {
            text,
            description: descriptionInput.value.trim(),
            deadline: deadlineInput.value,
            priority: priorityInput.value,
            estimateMinutes: Number(estimateInput.value) || 0,
            category: categoryInput.value.trim() || 'General'
        };

        saveTask(payload).catch((error) => showError(`Could not save task: ${error.message}`));
    }

    function cancelEdit() {
        editingTaskId = null;
        taskForm.reset();
        priorityInput.value = 'medium';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
        cancelEditBtn.classList.add('hidden');
    }

    function handleTaskAction(e) {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        const taskId = taskItem.dataset.id;

        if (e.target.closest('.task-checkbox')) toggleTaskStatus(taskId);
        if (e.target.closest('.edit-btn')) editTask(taskId);
        if (e.target.closest('.delete-btn')) deleteTask(taskId);
    }

    function editTask(id) {
        const task = tasks.find((t) => t.id === id);
        if (!task) return;

        taskInput.value = task.text;
        descriptionInput.value = task.description || '';
        deadlineInput.value = task.deadline || '';
        priorityInput.value = task.priority || 'medium';
        estimateInput.value = task.estimateMinutes || '';
        categoryInput.value = task.category || '';

        editingTaskId = id;
        addBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        cancelEditBtn.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function toggleTaskStatus(id) {
        const task = tasks.find((t) => t.id === id);
        if (!task) return;
        saveTaskCopies(id, {
            ...task,
            completed: !task.completed,
            uid: currentUser.uid,
            userId: currentUser.uid
        }, true)
            .then(() => {
                showToast('Task status updated.');
                return refreshTasksFromFirestore();
            })
            .catch((error) => showError(`Could not update task: ${error.message}`));
    }

    function deleteTask(id) {
        if (!confirm('Delete this task?')) return;
        deleteTaskCopies(id)
            .then(() => {
                showToast('Task deleted.');
                return refreshTasksFromFirestore();
            })
            .catch((error) => showError(`Could not delete task: ${error.message}`));
    }

    function deleteTaskCopies(id) {
        const deletes = [
            deleteFirestoreDocument(`users/${currentUser.uid}/tasks/${id}`),
            deleteFirestoreDocument(`tasks/${id}`)
        ];

        return Promise.allSettled(deletes).then((results) => {
            if (results.every((result) => result.status === 'rejected')) {
                throw results[0].reason;
            }
        });
    }

    function clearCompleted() {
        const completedTasks = tasks.filter((task) => task.completed);
        Promise.all(completedTasks.map((task) => deleteTaskCopies(task.id)))
            .then(() => {
                showToast('Completed tasks cleared.');
                return refreshTasksFromFirestore();
            })
            .catch((error) => showError(`Could not clear tasks: ${error.message}`));
    }

    function getDueStatus(deadline) {
        if (!deadline) return { label: 'Normal', className: 'due-normal', rank: 4 };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dueDate = parseDate(deadline); dueDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((dueDate - today) / 86400000);
        if (diffDays < 0) return { label: 'Overdue', className: 'due-overdue', rank: 1 };
        if (diffDays <= 1) return { label: 'Urgent', className: 'due-urgent', rank: 2 };
        if (diffDays <= 3) return { label: 'Due Soon', className: 'due-soon', rank: 3 };
        return { label: 'Normal', className: 'due-normal', rank: 4 };
    }

    function matchesFilter(task) {
        const due = getDueStatus(task.deadline).label;
        if (currentFilter === 'active') return !task.completed;
        if (currentFilter === 'completed') return task.completed;
        if (currentFilter === 'overdue') return !task.completed && due === 'Overdue';
        if (currentFilter === 'high-priority') return task.priority === 'high';
        if (currentFilter === 'due-soon') return !task.completed && (due === 'Urgent' || due === 'Due Soon');
        return true;
    }

    function sortTasks(items) {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return items.sort((a, b) => {
            if (currentSort === 'oldest') return getCreatedTime(a.createdAt) - getCreatedTime(b.createdAt);
            if (currentSort === 'deadline') return parseDate(a.deadline || '9999-12-31') - parseDate(b.deadline || '9999-12-31');
            if (currentSort === 'priority') return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
            return getCreatedTime(b.createdAt) - getCreatedTime(a.createdAt);
        });
    }

    function renderTasks() {
        const base = tasks.filter((task) => {
            const searchArea = `${task.text} ${task.description || ''} ${task.category || ''}`.toLowerCase();
            const searchMatch = !currentSearchTerm || searchArea.includes(currentSearchTerm);
            const categoryMatch = currentCategoryFilter === 'all' || (task.category || 'General') === currentCategoryFilter;
            return searchMatch && categoryMatch && matchesFilter(task);
        });

        const filtered = sortTasks([...base]);
        taskList.innerHTML = '';

        if (isLoadingTasks) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = 'Loading your saved tasks...';
        } else if (tasks.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = 'No tasks yet. Add your first task.';
        } else if (currentFilter === 'completed' && filtered.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = 'No completed tasks yet.';
        } else if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = currentSearchTerm ? 'No search results found.' : 'No tasks match current filters.';
        } else {
            emptyState.classList.add('hidden');
            filtered.forEach((task) => {
                const due = getDueStatus(task.deadline);
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''} ${due.label === 'Overdue' && !task.completed ? 'task-overdue' : ''}`;
                li.dataset.id = task.id;
                li.innerHTML = `
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                    <div class="task-content">
                        <span class="task-text">${escapeHTML(task.text)}</span>
                        ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ''}
                        <div class="task-meta">
                            <span class="category-badge">${escapeHTML(task.category || 'General')}</span>
                            <span class="priority-badge priority-${task.priority}">${task.priority} Priority</span>
                            <span class="due-badge ${due.className}">${due.label}</span>
                            ${task.estimateMinutes ? `<span class="estimate-badge"><i class="far fa-clock"></i> ${formatEstimate(task.estimateMinutes)}</span>` : ''}
                            ${task.deadline ? `<span class="deadline-badge"><i class="far fa-calendar-alt"></i> ${formatDate(task.deadline)}</span>` : ''}
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="edit-btn"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn"><i class="fas fa-trash-alt"></i></button>
                    </div>`;
                taskList.appendChild(li);
            });
        }

        const completed = tasks.filter((t) => t.completed).length;
        const pending = tasks.length - completed;
        const overdue = tasks.filter((t) => !t.completed && getDueStatus(t.deadline).label === 'Overdue').length;
        const highPriority = tasks.filter((t) => t.priority === 'high').length;
        const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

        summaryTotal.textContent = tasks.length;
        summaryCompleted.textContent = completed;
        summaryPending.textContent = pending;
        summaryOverdue.textContent = overdue;
        summaryHighPriority.textContent = highPriority;
        completionPercent.textContent = `${percent}%`;
        completionBar.style.width = `${percent}%`;

        taskCount.textContent = `${pending} task${pending === 1 ? '' : 's'} left`;
        clearCompletedBtn.style.visibility = completed ? 'visible' : 'hidden';

        taskList.classList.toggle('hidden', filtered.length === 0);
        rebuildCategoryFilter();
        renderInsights();
        renderStudyPlanner();
        renderWeeklyWorkload();
        renderAnalytics();
    }

    function renderInsights() {
        renderUpcomingDeadlines();
        renderPriorityBreakdown();
    }

    function renderUpcomingDeadlines() {
        const upcomingTasks = tasks
            .filter((task) => !task.completed && task.deadline)
            .sort((a, b) => parseDate(a.deadline) - parseDate(b.deadline))
            .slice(0, 3);

        if (upcomingTasks.length === 0) {
            upcomingList.innerHTML = '<li class="muted-list-item">No upcoming deadlines.</li>';
            return;
        }

        upcomingList.innerHTML = upcomingTasks.map((task) => {
            const due = getDueStatus(task.deadline);
            return `
                <li>
                    <span>${escapeHTML(task.text)}</span>
                    <strong class="${due.className}">${formatDate(task.deadline)}</strong>
                </li>`;
        }).join('');
    }

    function renderPriorityBreakdown() {
        const priorityCounts = {
            high: tasks.filter((task) => task.priority === 'high' && !task.completed).length,
            medium: tasks.filter((task) => task.priority === 'medium' && !task.completed).length,
            low: tasks.filter((task) => task.priority === 'low' && !task.completed).length
        };

        const pendingStudyMinutes = tasks
            .filter((task) => !task.completed)
            .reduce((total, task) => total + (Number(task.estimateMinutes) || 0), 0);

        priorityBreakdown.innerHTML = `
            <span class="priority-pill priority-high">High: ${priorityCounts.high}</span>
            <span class="priority-pill priority-medium">Medium: ${priorityCounts.medium}</span>
            <span class="priority-pill priority-low">Low: ${priorityCounts.low}</span>
            <span class="study-time-pill">Study time: ${formatEstimate(pendingStudyMinutes)}</span>`;
    }

    function renderStudyPlanner() {
        const recommendations = tasks
            .filter((task) => !task.completed)
            .map((task) => ({ task, score: getRecommendationScore(task), reasons: getRecommendationReasons(task) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        plannerCount.textContent = `${recommendations.length} recommendation${recommendations.length === 1 ? '' : 's'}`;

        if (recommendations.length === 0) {
            plannerList.innerHTML = '<li class="planner-empty">No pending tasks to recommend.</li>';
            return;
        }

        plannerList.innerHTML = recommendations.map(({ task, score, reasons }, index) => `
            <li class="planner-item">
                <div class="planner-rank">${index + 1}</div>
                <div class="planner-content">
                    <div class="planner-title-row">
                        <strong>${escapeHTML(task.text)}</strong>
                        <span>${score} pts</span>
                    </div>
                    <p>${escapeHTML(reasons.join(' + '))}</p>
                    <div class="task-meta">
                        <span class="priority-badge priority-${task.priority || 'medium'}">${task.priority || 'medium'} Priority</span>
                        <span class="due-badge ${getDueStatus(task.deadline).className}">${getDueStatus(task.deadline).label}</span>
                        ${task.estimateMinutes ? `<span class="estimate-badge"><i class="far fa-clock"></i> ${formatEstimate(task.estimateMinutes)}</span>` : ''}
                    </div>
                </div>
            </li>`).join('');
    }

    function getRecommendationScore(task) {
        const due = getDueStatus(task.deadline);
        const priorityScores = { high: 35, medium: 20, low: 10 };
        const dueScores = { Overdue: 45, Urgent: 35, 'Due Soon': 25, Normal: 5 };
        const estimate = Number(task.estimateMinutes) || 0;
        const studyWeight = estimate >= 120 ? 15 : estimate >= 60 ? 10 : estimate > 0 ? 5 : 0;

        return (priorityScores[task.priority] || 20) + (dueScores[due.label] || 5) + studyWeight;
    }

    function getRecommendationReasons(task) {
        const due = getDueStatus(task.deadline);
        const reasons = [`${due.label} deadline`];
        reasons.push(`${task.priority || 'medium'} priority`);

        const estimate = Number(task.estimateMinutes) || 0;
        if (estimate >= 120) reasons.push('large study block needed');
        else if (estimate >= 60) reasons.push('moderate study time');
        else if (estimate > 0) reasons.push('quick study task');

        return reasons;
    }

    function renderWeeklyWorkload() {
        const weekDays = getNextSevenDays();
        const pendingTasks = tasks.filter((task) => !task.completed && task.deadline);
        const totalMinutes = weekDays.reduce((total, day) => {
            const dayTasks = pendingTasks.filter((task) => task.deadline === day.key);
            return total + dayTasks.reduce((sum, task) => sum + (Number(task.estimateMinutes) || 0), 0);
        }, 0);

        workloadTotal.textContent = `${formatEstimate(totalMinutes)} planned`;
        workloadGrid.innerHTML = weekDays.map((day) => {
            const dayTasks = pendingTasks.filter((task) => task.deadline === day.key);
            const dayMinutes = dayTasks.reduce((sum, task) => sum + (Number(task.estimateMinutes) || 0), 0);
            const loadClass = dayMinutes >= 180 ? 'heavy-load' : dayMinutes >= 90 ? 'medium-load' : dayMinutes > 0 ? 'light-load' : '';

            return `
                <article class="workload-day ${loadClass}">
                    <div class="workload-day-header">
                        <strong>${day.label}</strong>
                        <span>${formatEstimate(dayMinutes)}</span>
                    </div>
                    <p>${day.dateLabel}</p>
                    ${renderWorkloadTasks(dayTasks)}
                </article>`;
        }).join('');
    }

    function renderWorkloadTasks(dayTasks) {
        if (dayTasks.length === 0) return '<ul><li>No deadlines</li></ul>';

        return `<ul>${dayTasks.slice(0, 3).map((task) => `
            <li>
                <span>${escapeHTML(task.text)}</span>
                <em>${task.priority || 'medium'}</em>
            </li>`).join('')}</ul>`;
    }

    function getNextSevenDays() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(today);
            date.setDate(today.getDate() + index);
            return {
                key: toDateInputValue(date),
                label: index === 0 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short' }),
                dateLabel: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
            };
        });
    }

    function toDateInputValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function renderAnalytics() {
        const pendingTasks = tasks.filter((task) => !task.completed);
        const overdueCount = pendingTasks.filter((task) => getDueStatus(task.deadline).label === 'Overdue').length;
        const highPriorityCount = pendingTasks.filter((task) => task.priority === 'high').length;
        const estimatedTasks = pendingTasks.filter((task) => Number(task.estimateMinutes) > 0);
        const averageMinutes = estimatedTasks.length
            ? Math.round(estimatedTasks.reduce((total, task) => total + Number(task.estimateMinutes), 0) / estimatedTasks.length)
            : 0;

        averageStudyTime.textContent = formatEstimate(averageMinutes);
        topCategory.textContent = getTopCategory();
        onTimeCount.textContent = tasks.filter((task) => task.completed || getDueStatus(task.deadline).label !== 'Overdue').length;

        const risk = getRiskLevel(overdueCount, highPriorityCount, pendingTasks.length);
        riskLevel.textContent = `${risk} risk`;
        riskLevel.className = `planner-count risk-${risk.toLowerCase()}`;

        renderBarChart(priorityChart, getCountsByPriority(pendingTasks), pendingTasks.length);
        renderBarChart(categoryChart, getCountsByCategory(tasks), tasks.length);
    }

    function getRiskLevel(overdueCount, highPriorityCount, pendingCount) {
        if (overdueCount >= 3 || highPriorityCount >= 5) return 'High';
        if (overdueCount >= 1 || highPriorityCount >= 2 || pendingCount >= 8) return 'Medium';
        return 'Low';
    }

    function getTopCategory() {
        const counts = getCountsByCategory(tasks);
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return top ? top[0] : 'None';
    }

    function getCountsByPriority(items) {
        return {
            High: items.filter((task) => task.priority === 'high').length,
            Medium: items.filter((task) => task.priority === 'medium').length,
            Low: items.filter((task) => task.priority === 'low').length
        };
    }

    function getCountsByCategory(items) {
        return items.reduce((counts, task) => {
            const category = task.category || 'General';
            counts[category] = (counts[category] || 0) + 1;
            return counts;
        }, {});
    }

    function renderBarChart(container, counts, total) {
        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        if (entries.length === 0 || total === 0) {
            container.innerHTML = '<p class="muted-list-item">No data yet.</p>';
            return;
        }

        container.innerHTML = entries.map(([label, count]) => {
            const percent = Math.round((count / total) * 100);
            return `
                <div class="bar-row">
                    <div class="bar-label">
                        <span>${escapeHTML(label)}</span>
                        <strong>${count}</strong>
                    </div>
                    <div class="bar-track"><span style="width: ${percent}%"></span></div>
                </div>`;
        }).join('');
    }

    function rebuildCategoryFilter() {
        const categories = [...new Set(tasks.map((task) => task.category || 'General'))].sort();
        const selected = currentCategoryFilter;
        categoryFilter.innerHTML = '<option value="all">All Categories</option>' + categories.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
        categoryFilter.value = categories.includes(selected) ? selected : 'all';
        currentCategoryFilter = categoryFilter.value;
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 1800);
    }

    function showError(message) {
        showToast(message);
    }

    function setSavingState(isSaving) {
        isSavingTask = isSaving;
        addBtn.disabled = isSaving;
        addBtn.innerHTML = isSaving
            ? '<i class="fas fa-spinner fa-spin"></i> Saving'
            : editingTaskId ? '<i class="fas fa-save"></i> Update' : '<i class="fas fa-plus"></i> Add';
    }

    function exportTasks() {
        if (tasks.length === 0) {
            showToast('No tasks to export.');
            return;
        }

        const headers = ['Title', 'Description', 'Category', 'Priority', 'Deadline', 'Due Status', 'Estimate Minutes', 'Completed'];
        const rows = tasks.map((task) => [
            task.text,
            task.description || '',
            task.category || 'General',
            task.priority || 'medium',
            task.deadline || '',
            getDueStatus(task.deadline).label,
            task.estimateMinutes || 0,
            task.completed ? 'Yes' : 'No'
        ]);

        const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `student-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('Tasks exported.');
    }

    function csvCell(value) {
        return `"${String(value).replace(/"/g, '""')}"`;
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
    }

    function parseDate(value) {
        if (!value) return new Date('9999-12-31');
        if (value.toDate) return value.toDate();
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [year, month, day] = value.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        return new Date(value);
    }

    function formatDate(value) {
        return parseDate(value).toLocaleDateString();
    }

    function formatEstimate(minutes) {
        const totalMinutes = Number(minutes) || 0;
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (hours && mins) return `${hours}h ${mins}m`;
        if (hours) return `${hours}h`;
        return `${mins}m`;
    }

    function getCreatedTime(value) {
        if (!value) return 0;
        if (value.toMillis) return value.toMillis();
        return parseDate(value).getTime();
    }

    function createTaskId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    async function refreshTasksFromFirestore(showRefreshing = false) {
        if (!currentUser) return;
        if (showRefreshing) syncStatus.textContent = 'Refreshing...';

        const [userPathResult, userIdResult, uidResult] = await Promise.allSettled([
            listFirestoreDocuments(`users/${currentUser.uid}/tasks`),
            queryRootTasks('userId'),
            queryRootTasks('uid')
        ]);

        const userPathTasks = userPathResult.status === 'fulfilled' ? userPathResult.value : [];
        const userIdTasks = userIdResult.status === 'fulfilled' ? userIdResult.value : [];
        const uidTasks = uidResult.status === 'fulfilled' ? uidResult.value : [];

        const mergedTasks = new Map();
        [...userPathTasks, ...userIdTasks, ...uidTasks].forEach((task) => mergedTasks.set(task.id, task));

        tasks = Array.from(mergedTasks.values());
        isLoadingTasks = false;

        const errors = [userPathResult, userIdResult, uidResult]
            .filter((result) => result.status === 'rejected')
            .map((result) => result.reason.message);
        if (errors.length === 3) showError(errors.join(' | '));

        syncStatus.textContent = `Last synced ${new Date().toLocaleTimeString()}`;
        renderTasks();
    }

    async function firestoreHeaders() {
        const token = await currentUser.getIdToken();
        return {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    function firestoreUrl(path) {
        return `https://firestore.googleapis.com/v1/projects/${window.firebaseConfig.projectId}/databases/(default)/documents/${path}`;
    }

    function firestoreRunQueryUrl() {
        return `https://firestore.googleapis.com/v1/projects/${window.firebaseConfig.projectId}/databases/(default)/documents:runQuery`;
    }

    async function writeFirestoreDocument(path, data) {
        const response = await fetch(firestoreUrl(path), {
            method: 'PATCH',
            headers: await firestoreHeaders(),
            body: JSON.stringify({ fields: toFirestoreFields(data) })
        });

        if (!response.ok) throw new Error(await getFirestoreError(response));
    }

    async function deleteFirestoreDocument(path) {
        const response = await fetch(firestoreUrl(path), {
            method: 'DELETE',
            headers: await firestoreHeaders()
        });

        if (!response.ok && response.status !== 404) throw new Error(await getFirestoreError(response));
    }

    async function listFirestoreDocuments(path) {
        const response = await fetch(firestoreUrl(path), {
            headers: await firestoreHeaders()
        });

        if (response.status === 404) return [];
        if (!response.ok) throw new Error(await getFirestoreError(response));

        const data = await response.json();
        return (data.documents || []).map(fromFirestoreDocument);
    }

    async function queryRootTasks(field) {
        const response = await fetch(firestoreRunQueryUrl(), {
            method: 'POST',
            headers: await firestoreHeaders(),
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'tasks' }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: field },
                            op: 'EQUAL',
                            value: { stringValue: currentUser.uid }
                        }
                    }
                }
            })
        });

        if (!response.ok) throw new Error(await getFirestoreError(response));

        const rows = await response.json();
        return rows.filter((row) => row.document).map((row) => fromFirestoreDocument(row.document));
    }

    function toFirestoreFields(data) {
        return Object.entries(data).reduce((fields, [key, value]) => {
            fields[key] = toFirestoreValue(value);
            return fields;
        }, {});
    }

    function toFirestoreValue(value) {
        if (typeof value === 'boolean') return { booleanValue: value };
        if (typeof value === 'number') return { doubleValue: value };
        return { stringValue: value == null ? '' : String(value) };
    }

    function fromFirestoreDocument(document) {
        const id = document.name.split('/').pop();
        const data = Object.entries(document.fields || {}).reduce((task, [key, value]) => {
            task[key] = fromFirestoreValue(value);
            return task;
        }, {});

        return { id, ...data };
    }

    function fromFirestoreValue(value) {
        if ('booleanValue' in value) return value.booleanValue;
        if ('integerValue' in value) return Number(value.integerValue);
        if ('doubleValue' in value) return Number(value.doubleValue);
        if ('timestampValue' in value) return value.timestampValue;
        return value.stringValue || '';
    }

    async function getFirestoreError(response) {
        try {
            const data = await response.json();
            return data.error && data.error.message ? data.error.message : response.statusText;
        } catch {
            return response.statusText;
        }
    }
});
