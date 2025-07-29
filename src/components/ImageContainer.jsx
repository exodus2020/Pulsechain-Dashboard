import React, { memo, useState } from 'react';
import styled from 'styled-components';
import ImgQuestion from "../icons/question.png";

const IconWrapper = styled.div`
  border-radius: 5px;
  display: inline-block;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  svg {
    fill: currentColor;
    width: 100%;
    height: 100%;
  }
  img {
    border-radius: 3px;
  }
`;


const ImageContainer = ({ source, size = 24, style = {}}) => {
  const [ error, setError ] = useState(false)

  return (
    <IconWrapper size={size} style={style}>
      <img src={error ? ImgQuestion : source} style={{ height: size, width: size}} onError={() =>{setError(true)}}/>
    </IconWrapper>
  );
};

export default memo(ImageContainer);
