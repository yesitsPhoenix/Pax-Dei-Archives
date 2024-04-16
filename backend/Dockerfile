# For more information, please refer to https://aka.ms/vscode-docker-python
FROM python:3.10-slim

EXPOSE 8000

# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1

# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

WORKDIR /backend
ENV PYTHONPATH=/backend
# Install pip requirements
COPY requirements.txt /backend/
RUN python -m pip install -r ./requirements.txt

COPY . /backend/
