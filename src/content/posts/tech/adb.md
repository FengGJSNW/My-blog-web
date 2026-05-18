---
title: 安卓调试桥adb的使用[编写中]
published: 2026-01-10
description: 调试工具
tags: [调试工具]
category: 工具
draft: false
---

# 安卓调试桥

## 简介
Android 调试桥 (adb) 是一种功能多样的命令行工具，可让您与设备进行通信。adb 命令可用于执行各种设备操作，例如安装和调试应用。adb 提供对 Unix shell（可用来在设备上运行各种命令）的访问权限。它是一种客户端-服务器程序，包括以下三个组件：

* 客户端：用于发送命令。客户端在开发机器上运行。您可以通过发出 adb 命令从命令行终端调用客户端。
* 守护程序 (adbd)：用于在设备上运行命令。守护程序在每个设备上作为后台进程运行。
* 服务器：用于管理客户端与守护程序之间的通信。服务器在开发机器上作为后台进程运行。

## 下载(官网直链)

>windows平台：[Click here to download](https://googledownloads.cn/android/repository/platform-tools-latest-windows.zip)
>
>macos平台：[Click here to download](https://googledownloads.cn/android/repository/platform-tools-latest-darwin.zip)
>
>linux平台：[Click here to download](https://googledownloads.cn/android/repository/platform-tools-latest-linux.zip)

## 基础命令的使用

### 连接
### 传输文件
```shell
//推送(电脑->手机)
//拉取(手机->电脑)
//安装程序
adb install [apk在电脑中的地址]

```
### 控制
### 简易sh命令
### ...