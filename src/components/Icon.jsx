import React from 'react';
import styled from 'styled-components';

const IconWrapper = styled.div`
  display: inline-block;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  svg {
    fill: currentColor;
    width: 100%;
    height: 100%;
  }
`;

const Icon = ({ icon, size = 24, style = {} }) => {
  return (
    <IconWrapper size={size} style={style}>
        {icon}
    </IconWrapper>
  );
};

export default Icon;
