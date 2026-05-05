// StatusButton.jsx
import styled, { css } from "styled-components";

const StylizedStatus = styled.div`
  border-radius: 50%;
  display: inline-block;
  transition: background-color 0.3s, box-shadow 0.3s;

  ${({ $status }) =>
    $status === 0 &&
    css`
      background-color: #4d4d4d;
      box-shadow: inset 0px 2px 5px rgba(0, 0, 0, 0.8);
    `}

  ${({ $status }) =>
    $status === 1 &&
    css`
      background-color: #00ff00;
      box-shadow: inset 0px 2px 5px rgba(0, 0, 0, 0.5), 0px 0px 10px #00ff00;
    `}

  ${({ $status }) =>
    $status === 2 &&
    css`
      background-color: #ff0000;
      box-shadow: inset 0px 2px 5px rgba(0, 0, 0, 0.5), 0px 0px 10px #ff0000;
    `}

  ${({ $status }) =>
    $status === 3 &&
    css`
      background-color: #ffff00;
      box-shadow: inset 0px 2px 5px rgba(0, 0, 0, 0.5), 0px 0px 10px #ffff00;
    `}
`;

export default function StatusButton({ status, size = 40 }) {
  return (
    <StylizedStatus
      $status={status}
      style={{ height: size, width: size }}
    />
  );
}