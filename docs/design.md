# Data Design

The system stores data as an array of task objects. Each task contains the following attributes:
- Task name
- Description
- Deadline
- Priority
- Completion status

The data is stored using localStorage in JSON format. This allows tasks to persist after refreshing the page.

## Entity Relationship Diagram

The system uses a single entity called Task. Each task is independent and does not currently have relationships with other entities. The structure is designed to allow future expansion, such as linking tasks to user accounts.
