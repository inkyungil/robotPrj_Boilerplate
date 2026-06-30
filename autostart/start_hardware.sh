#!/bin/bash
source /opt/ros/jazzy/setup.bash
source /home/pinky/pinky_pro/install/setup.bash
exec ros2 launch pinky_bringup bringup_robot.launch.xml
