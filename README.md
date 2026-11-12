# order-site-infra

Учебный проект базовой инфраструктуры MVP системы обработки заказов на одном VPS с Ubuntu 22.04. Сервисы запускаются в Docker Compose. Сейчас конфигурация предоставляет заглушку сайта, pgAdmin, Docker Registry и автоматическое обновление помеченных контейнеров; backend-приложение пока не включено.

## Состав проекта

```text
.
├── .env.example
├── .gitignore
├── docker-compose.yml
├── nginx/
│   ├── conf.d/
│   │   └── default.conf
│   └── html/
│       └── index.html
└── registry/
    ├── auth/
    │   └── .gitkeep
    └── create-user.sh
```

Файл `.env` и `registry/auth/htpasswd` создаются при настройке и в репозитории не хранятся.

## Сетевые порты

Снаружи VPS опубликованы только порты Nginx:

| Порт | Назначение |
| --- | --- |
| `80` | Заглушка сайта «Система обработки заказов» |
| `5050` | pgAdmin 4 через прокси Nginx |
| `5000` | Docker Registry через прокси Nginx |

PostgreSQL, pgAdmin, Registry и Watchtower не публикуют собственные порты на хосте. Сервисы, к которым обращаются другие контейнеры, доступны через внутреннюю сеть Docker.

Требуются Docker и плагин docker compose. Скрипт registry/create-user.sh использует образ httpd:2, поэтому на сервере должен работать Docker.

## Запуск

Все команды ниже выполняются на VPS из корня проекта.

1. Создайте файл окружения и задайте собственные значения:

   ```bash
   cp .env.example .env
   nano .env
   ```

   Укажите свои значения для `POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_PASSWORD` и `PGADMIN_DEFAULT_EMAIL`. Не используйте `CHANGE_ME` в качестве пароля. Имена базы данных и пользователя PostgreSQL также задаются в этом файле.

2. Создайте пользователя Docker Registry. Скрипт запросит пароль интерактивно:

   ```bash
   bash registry/create-user.sh registry-user
   ```

   Вместо `registry-user` укажите выбранное имя. Скрипт запишет учётные данные в `registry/auth/htpasswd`.

3. Запустите сервисы и проверьте их состояние:

   ```bash
   docker compose up -d
   docker compose ps
   ```

## Проверка работы

- Откройте `http://<SERVER_IP>/` — должна отображаться заглушка сайта о разработке.
- Откройте `http://<SERVER_IP>:5050/` — появится форма входа pgAdmin. Используйте значения `PGADMIN_DEFAULT_EMAIL` и `PGADMIN_DEFAULT_PASSWORD` из `.env`.
- Проверьте API Registry с созданными учётными данными:

  ```bash
  curl -u registry-user http://<SERVER_IP>:5000/v2/_catalog
  ```

  `curl` запросит пароль; при успешной проверке ответ: {"repositories":[]}

- Если сервис не отвечает, проверьте `docker compose ps` и журналы сервисов командой `docker compose logs`.

## Файрвол UFW

Для доступа к VPS разрешите SSH и опубликованные порты Nginx:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 5050/tcp
sudo ufw allow 5000/tcp
sudo ufw status
```

Эти правила открывают порты `5050` и `5000` для всех IP-адресов, если доступ дополнительно не ограничен внешним файрволом.
Docker сам публикует порты контейнеров и может обходить правила ufw для них. Работу ufw для портов 5050 и 5000 мы отдельно не проверяли.

## Безопасность и ограничения

- Пароли и другие параметры окружения задаются в `.env`. Файлы `.env` и `registry/auth/htpasswd` исключены из Git через `.gitignore`; не добавляйте их в репозиторий.
- HTTPS в конфигурации нет: соединения работают по HTTP, поэтому логин и пароль передаются открытым текстом. Не используйте эти интерфейсы в недоверенной сети без дополнительной защиты.
- Порты `5050` (pgAdmin) и `5000` (Registry) опубликованы на всех интерфейсах VPS. Ограничьте доступ средствами сетевого файрвола, если он не должен быть общедоступным.
- Watchtower получает доступ к `/var/run/docker.sock`, что предоставляет ему широкие возможности управления Docker на хосте.
- Watchtower настроен с `WATCHTOWER_LABEL_ENABLE=true` и обновляет только контейнеры с меткой `com.centurylinklabs.watchtower.enable=true`. В текущем `docker-compose.yml` такая метка сервисам не назначена, поэтому контейнеры этого проекта не помечены для обновления.
- Сервис backend в `docker-compose.yml` оставлен закомментированным и не запускается.

## Примечание

Вместо архивированного `containrrr/watchtower` используется форк `nickfedor/watchtower`. Скрипт `registry/create-user.sh` запрашивает пароль интерактивно.
