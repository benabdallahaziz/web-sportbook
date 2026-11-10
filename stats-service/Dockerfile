FROM php:8.3-cli
RUN mkdir /data && chmod 777 /data
WORKDIR /app
COPY index.php .
EXPOSE 8088
CMD ["php", "-S", "0.0.0.0:8088", "index.php"]