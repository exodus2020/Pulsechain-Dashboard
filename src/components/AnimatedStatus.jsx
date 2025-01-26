import styled, { css, keyframes } from "styled-components";

const rotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const AnimatedIconContainer = styled.div`
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: ${({ status }) =>
    status === 1
      ? "rgb(0, 255, 0)" /* Green */
      : status === 2
      ? "rgb(255, 255, 0)" /* Yellow */
      : status === 3
      ? "rgb(255, 0, 0)" /* Red */
      : "rgb(77, 77, 77)"}; /* Gray */
  box-shadow: 0px 0px ${({ size }) => size * 0.3}px
    ${({ status }) =>
      status === 1
        ? "rgb(0, 255, 0)" /* Green */
        : status === 2
        ? "rgb(255, 255, 0)" /* Yellow */
        : status === 3
        ? "rgb(255, 0, 0)" /* Red */
        : "rgb(77, 77, 77)"}; /* Gray */
  transition: background-color 0.5s, box-shadow 0.5s;
`;

const Icon = styled.div`
  width: ${({ size }) => size * 0.5}px;
  height: ${({ size }) => size * 0.5}px;
  border: ${({ size }) => size * 0.1}px solid
    ${({ status }) =>
      status === 1
        ? "rgb(55, 155, 55)" /* Green border */
        : status === 2
        ? "rgb(155, 155, 55)" /* Yellow border */
        : status === 3
        ? "rgb(155, 55, 55)" /* Red border */
        : "rgb(153, 153, 153)"}; /* Gray border */
  border-top: ${({ size }) => size * 0.1}px solid
    ${({ status }) =>
      status === 1
        ? "rgb(0, 255, 0)" /* Green */
        : status === 2
        ? "rgb(255, 255, 0)" /* Yellow */
        : status === 3
        ? "rgb(255, 0, 0)" /* Red */
        : "rgb(102, 102, 102)"}; /* Gray */
  border-radius: 50%;
  animation: ${({ status }) =>
    status === 1
      ? css`
          ${rotate} 1s linear infinite
        `
      : status === 2
      ? css`
          ${rotate} 2s linear infinite
        `
      : status === 3
      ? css`
          ${rotate} 3s linear infinite
        `
      : css`
          ${rotate} 3s linear infinite
        `};
  animation-play-state: ${({ status }) =>
    status === 1 || status === 2 ? "running" : "paused"};
  transition: border 0.5s, animation 2s ease-out;
`;

export default function AnimatedStatus({ status, size = 40 }) {
  return (
    <AnimatedIconContainer status={status} size={size}>
      <Icon status={status} size={size} />
    </AnimatedIconContainer>
  );
}
