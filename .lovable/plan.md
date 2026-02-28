
# Добавить уведомление "Подготовка файла..." при скачивании

## Проблема
При нажатии на кнопку скачивания ничего визуально не происходит несколько секунд, пока файл подготавливается на сервере. Пользователь не понимает, загружается файл или нет.

## Решение
Добавить `toast.loading("Подготовка файла...")` во все три роли при скачивании/открытии файла. Тост автоматически закрывается после завершения операции.

## Изменения (3 файла)

### 1. `src/components/dashboard/MaterialsTab.tsx` (ученик)
- В `handleOpenFile`: добавить `const loadingToast = toast.loading(...)` перед try
- В конце добавить `finally { toast.dismiss(loadingToast); }`

### 2. `src/components/teacher/TeacherMaterialsTab.tsx` (учитель)
- Аналогично: `toast.loading` перед try, `toast.dismiss` в finally

### 3. `src/components/creator/ProductMaterialsManager.tsx` (автор)
- Аналогично: `toast.loading` перед try, `toast.dismiss` в finally (рядом с существующим `setIsLoadingUrl`)
